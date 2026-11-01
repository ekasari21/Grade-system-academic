$(document).ready(function () {
  let recapCoursesList = [];
  let currentRecapData = null;
  let chartCPLScoresInstance = null;
  let chartGradeDistInstance = null;
  let chartCPLRadarInstance = null;

  // Inisialisasi Autentikasi
  initAuth().done(function () {
    loadRecapCourses();
  });

  // Event Handlers Toolbar
  $('#recapCourseSelect').on('change', function () {
    const courseId = $(this).val();
    if (courseId) {
      loadCourseRecap(courseId);
    }
  });

  $('#btnRecapRefresh').on('click', function () {
    const courseId = $('#recapCourseSelect').val();
    if (courseId) {
      loadCourseRecap(courseId);
    }
  });

  $('#matrixSearchInput').on('input', function () {
    filterAndRenderMatrix();
  });

  $('#matrixFilterStatus').on('change', function () {
    filterAndRenderMatrix();
  });

  $('#chkShowComponents').on('change', function () {
    if (currentRecapData) {
      renderMatrixHeader(currentRecapData);
      filterAndRenderMatrix();
    }
  });

  $('#btnExportCSV').on('click', function () {
    exportToCSV();
  });

  $('#btnPrintReport').on('click', function () {
    prepareAndPrint();
  });

  $('#btnRecapSimulate').on('click', function () {
    const courseId = $('#recapCourseSelect').val();
    if (!courseId) return;

    if (!confirm('Jalankan simulasi 5 mahasiswa OBE untuk mata kuliah ini? Data penilaian sebelumnya pada 5 mahasiswa simulasi akan diperbarui.')) {
      return;
    }

    const $btn = $(this);
    $btn.prop('disabled', true).text('⏳ Memproses Simulasi...');

    $.ajax({
      url: `/api/private/courses/${courseId}/simulate-obe`,
      type: 'POST',
      success: function (res) {
        showAlert('#recapAlert', res.message || 'Simulasi 5 mahasiswa OBE berhasil dijalankan!', 'success');
        loadCourseRecap(courseId);
      },
      error: function (xhr) {
        const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menjalankan simulasi OBE';
        showAlert('#recapAlert', msg, 'danger');
      },
      complete: function () {
        $btn.prop('disabled', false).text('✨ Simulasi 5 Mahasiswa OBE');
      }
    });
  });

  // ==========================================
  // 1. MEMUAT DAFTAR MATA KULIAH
  // ==========================================
  function loadRecapCourses() {
    $.ajax({
      url: '/api/private/courses',
      type: 'GET',
      success: function (res) {
        recapCoursesList = res.data || [];
        const select = $('#recapCourseSelect');
        select.empty();

        if (recapCoursesList.length === 0) {
          select.append('<option value="">Belum ada mata kuliah</option>');
          $('#recapMatrixBody').html('<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 20px;">Belum ada mata kuliah yang terdaftar.</td></tr>');
          return;
        }

        recapCoursesList.forEach(c => {
          select.append(`<option value="${c.id}">${c.code} - ${c.name} (${c.credits} SKS)</option>`);
        });

        // Pilih mata kuliah pertama secara default
        const firstId = recapCoursesList[0].id;
        select.val(firstId);
        loadCourseRecap(firstId);
      },
      error: function () {
        showAlert('#recapAlert', 'Gagal memuat daftar mata kuliah', 'danger');
      }
    });
  }

  // ==========================================
  // 2. MEMUAT REKAPITULASI DARI API
  // ==========================================
  function loadCourseRecap(courseId) {
    if (!courseId) return;

    const course = recapCoursesList.find(c => c.id == courseId);
    if (course) {
      $('#recapCourseBadge').text(`Mata Kuliah: ${course.code} (${course.credits} SKS)`);
      $('#printCourseName').text(course.name);
      $('#printCourseCode').text(course.code);
      $('#printCourseCredits').text(course.credits);
    }

    // Tampilkan placeholder loading
    $('#recapMatrixBody').html('<tr><td colspan="12" style="text-align: center; color: #64748b; padding: 24px;">⏳ Memuat data rekapitulasi penilaian kelas...</td></tr>');
    $('#cqiTableBody').html('<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 16px;">⏳ Memuat data evaluasi mutu CPL...</td></tr>');

    $.ajax({
      url: `/api/private/courses/${courseId}/cpl-recap`,
      type: 'GET',
      success: function (res) {
        currentRecapData = res;

        // 1. Render Top KPI
        renderKPIs(res);

        // 2. Render Charts (Chart.js)
        renderCharts(res);

        // 3. Render Header Matriks
        renderMatrixHeader(res);

        // 4. Render Body & Foot Matriks
        filterAndRenderMatrix();

        // 5. Render CQI Table & Recommendations
        renderCQISection(res);
      },
      error: function (xhr) {
        const msg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal memuat rekapitulasi nilai';
        showAlert('#recapAlert', msg, 'danger');
      }
    });
  }

  // ==========================================
  // 3. RENDER TOP KPI CARDS
  // ==========================================
  function renderKPIs(data) {
    const totalStudents = data.total_students_assessed || 0;
    const avgScore = data.class_average_final_score || 0.0;
    const academicPassRate = data.academic_pass_rate || 0.0;
    const overallCPLRate = data.overall_cpl_rate || 0.0;
    const totalCPLAssessed = data.total_cpl_assessed_global || 0;
    const totalCPLAchieved = data.total_cpl_achieved_global || 0;

    $('#kpiTotalStudents').text(totalStudents);
    $('#kpiStudentsSub').text(totalStudents > 0 ? `${totalStudents} Mahasiswa dinilai lengkap` : 'Belum ada penilaian');

    $('#kpiAverageScore').text(avgScore.toFixed(2));
    const letterGrade = determineGradeLetter(avgScore);
    $('#kpiAverageGradeBadge')
      .text(letterGrade)
      .attr('class', `badge-grade badge-${letterGrade.replace('/', '')}`);
    $('#kpiAcademicPassRate').text(`Kelulusan: ${academicPassRate.toFixed(1)}%`);

    $('#kpiCPLPassRate').text(`${overallCPLRate.toFixed(1)}%`);
    $('#kpiCPLCounts').text(`${totalCPLAchieved} dari ${totalCPLAssessed} Evaluasi Lulus (≥70)`);

    if (totalStudents > 0) {
      $('#kpiHighestStudent').html(`Tertinggi: <strong>${escapeHtml(data.highest_student || '-')}</strong>`);
      $('#kpiLowestStudent').html(`Terendah: <strong>${escapeHtml(data.lowest_student || '-')}</strong>`);
    } else {
      $('#kpiHighestStudent').text('Tertinggi: -');
      $('#kpiLowestStudent').text('Terendah: -');
    }
  }

  function determineGradeLetter(score) {
    if (score >= 85) return 'A';
    if (score >= 80) return 'AB';
    if (score >= 75) return 'B';
    if (score >= 70) return 'BC';
    if (score >= 65) return 'C';
    if (score >= 50) return 'D';
    return 'E';
  }

  // ==========================================
  // 4. RENDER VISUAL CHARTS (CHART.JS)
  // ==========================================
  function renderCharts(data) {
    const recapList = data.cpl_recap || [];
    const dist = data.grade_distribution || {};

    // ----------------------------------------------------
    // Chart 1: Bar Chart Ketercapaian Nilai CPL vs Target
    // ----------------------------------------------------
    const cplLabels = recapList.map(r => r.cpl_code);
    const cplScores = recapList.map(r => r.average_score);
    const cplTargets = recapList.map(() => 70.0);
    const cplBarColors = cplScores.map(s => s >= 70.0 ? '#10b981' : '#ef4444');

    if (chartCPLScoresInstance) {
      chartCPLScoresInstance.destroy();
    }

    const ctx1 = document.getElementById('chartCPLScores');
    if (ctx1) {
      chartCPLScoresInstance = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: {
          labels: cplLabels,
          datasets: [
            {
              label: 'Rata-Rata Nilai CPL',
              data: cplScores,
              backgroundColor: cplBarColors,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: cplBarColors
            },
            {
              label: 'Target Standar Minimal (70.0)',
              data: cplTargets,
              type: 'line',
              borderColor: '#f43f5e',
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 4,
              pointBackgroundColor: '#f43f5e',
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 14,
                font: { size: 11, weight: 'bold' }
              }
            },
            tooltip: {
              callbacks: {
                afterLabel: function (context) {
                  const idx = context.dataIndex;
                  const item = recapList[idx];
                  if (item && context.datasetIndex === 0) {
                    return `Tingkat Lulus: ${item.pass_rate.toFixed(1)}% (${item.achieved_count}/${item.total_assessed} mhs)`;
                  }
                  return '';
                }
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: { stepSize: 20 },
              grid: { color: '#f1f5f9' }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    }

    // ----------------------------------------------------
    // Chart 2: Doughnut Chart Distribusi Nilai Huruf
    // ----------------------------------------------------
    const gradeLabels = ['A', 'AB', 'B', 'BC', 'C', 'D', 'E'];
    const gradeCounts = gradeLabels.map(g => dist[g] || 0);
    const gradeColors = [
      '#10b981', // A (Emerald)
      '#06b6d4', // AB (Cyan)
      '#3b82f6', // B (Blue)
      '#8b5cf6', // BC (Purple)
      '#f59e0b', // C (Amber)
      '#f97316', // D (Orange)
      '#ef4444'  // E (Rose)
    ];

    if (chartGradeDistInstance) {
      chartGradeDistInstance.destroy();
    }

    const ctx2 = document.getElementById('chartGradeDist');
    if (ctx2) {
      chartGradeDistInstance = new Chart(ctx2.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: gradeLabels,
          datasets: [
            {
              data: gradeCounts,
              backgroundColor: gradeColors,
              borderWidth: 2,
              borderColor: '#ffffff'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                font: { size: 10, weight: 'bold' }
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    // ----------------------------------------------------
    // Chart 3: Radar Chart Profil Kompetensi CPL
    // ----------------------------------------------------
    if (chartCPLRadarInstance) {
      chartCPLRadarInstance.destroy();
    }

    const ctx3 = document.getElementById('chartCPLRadar');
    if (ctx3) {
      chartCPLRadarInstance = new Chart(ctx3.getContext('2d'), {
        type: 'radar',
        data: {
          labels: cplLabels,
          datasets: [
            {
              label: 'Profil Penguasaan Kelas',
              data: cplScores,
              backgroundColor: 'rgba(59, 130, 246, 0.25)',
              borderColor: '#2563eb',
              pointBackgroundColor: '#2563eb',
              pointBorderColor: '#ffffff',
              borderWidth: 2
            },
            {
              label: 'Target OBE (70)',
              data: cplTargets,
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: '#ef4444',
              borderDash: [4, 4],
              pointRadius: 2,
              borderWidth: 1.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, font: { size: 10 } }
            }
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { stepSize: 25, display: false },
              grid: { color: '#e2e8f0' },
              angleLines: { color: '#cbd5e1' }
            }
          }
        }
      });
    }
  }

  // ==========================================
  // 5. RENDER HEADER MATRIKS
  // ==========================================
  function renderMatrixHeader(data) {
    const head = $('#recapMatrixHead');
    head.empty();

    const cplCols = data.cpl_columns || [];
    const items = data.assessment_items || [];
    const showComponents = $('#chkShowComponents').is(':checked');

    let row1 = '<tr>';
    row1 += '<th rowspan="2" style="width: 40px; text-align: center; vertical-align: middle;">No</th>';
    row1 += '<th rowspan="2" style="width: 100px; text-align: left; vertical-align: middle;">NIM</th>';
    row1 += '<th rowspan="2" style="min-width: 170px; text-align: left; vertical-align: middle;">Nama Mahasiswa</th>';

    if (showComponents && items.length > 0) {
      row1 += `<th colspan="${items.length}" style="text-align: center; background: #1e293b; border-left: 2px solid #334155; border-right: 2px solid #334155;">Komponen Penilaian Akademik (Total 100%)</th>`;
    }

    if (cplCols.length > 0) {
      row1 += `<th colspan="${cplCols.length}" style="text-align: center; background: #0369a1; border-right: 2px solid #0284c7;">Penguasaan Capaian Pembelajaran Lulusan (CPL Target ≥ 70)</th>`;
    }

    row1 += '<th rowspan="2" style="width: 85px; text-align: center; vertical-align: middle; background: #0f172a;">% Ketercapaian CPL</th>';
    row1 += '<th rowspan="2" style="width: 85px; text-align: center; vertical-align: middle; background: #0f172a;">Nilai Akhir</th>';
    row1 += '<th rowspan="2" style="width: 60px; text-align: center; vertical-align: middle; background: #0f172a;">Grade</th>';
    row1 += '<th rowspan="2" style="width: 95px; text-align: center; vertical-align: middle; background: #0f172a;">Predikat</th>';
    row1 += '<th rowspan="2" style="width: 105px; text-align: center; vertical-align: middle; background: #0f172a;">Status CPL</th>';
    row1 += '</tr>';

    let row2 = '<tr>';
    if (showComponents && items.length > 0) {
      items.forEach(it => {
        const cplCode = it.course_cpl ? it.course_cpl.code : (it.cpl_id ? `CPL-${it.cpl_id}` : '');
        row2 += `<th style="text-align: center; font-size: 0.78rem; background: #334155; min-width: 85px;">
                  <div>${escapeHtml(it.name)}</div>
                  <div style="font-size: 0.72rem; color: #93c5fd;">${it.weight}% • ${cplCode}</div>
                 </th>`;
      });
    }

    if (cplCols.length > 0) {
      cplCols.forEach(c => {
        row2 += `<th style="text-align: center; font-size: 0.8rem; background: #0284c7; min-width: 80px;" title="${escapeHtml(c.description || '')}">
                  <div><strong>${c.code}</strong></div>
                  <div style="font-size: 0.7rem; color: #e0f2fe;">Min: ${c.target_score || 70}</div>
                 </th>`;
      });
    }
    row2 += '</tr>';

    head.append(row1 + row2);
  }

  // ==========================================
  // 6. FILTER DAN RENDER BODY & FOOT MATRIKS
  // ==========================================
  function filterAndRenderMatrix() {
    if (!currentRecapData) return;

    const tbody = $('#recapMatrixBody');
    const tfoot = $('#recapMatrixFoot');
    tbody.empty();
    tfoot.empty();

    const students = currentRecapData.student_matrix || [];
    const cplCols = currentRecapData.cpl_columns || [];
    const items = currentRecapData.assessment_items || [];
    const showComponents = $('#chkShowComponents').is(':checked');

    const searchKeyword = ($('#matrixSearchInput').val() || '').toLowerCase().trim();
    const filterStatus = $('#matrixFilterStatus').val();

    // Saring data mahasiswa
    const filtered = students.filter(s => {
      // 1. Keyword search (Name / NIM)
      const matchSearch = !searchKeyword ||
        (s.name && s.name.toLowerCase().includes(searchKeyword)) ||
        (s.nim && s.nim.toLowerCase().includes(searchKeyword));

      if (!matchSearch) return false;

      // 2. Status filter
      if (filterStatus === 'pass_all') {
        return s.cpl_achievement_rate >= 100.0;
      } else if (filterStatus === 'has_fail') {
        return s.cpl_achievement_rate < 100.0;
      }
      return true;
    });

    $('#matrixShowingCount').text(`Menampilkan ${filtered.length} dari ${students.length} mahasiswa`);

    if (filtered.length === 0) {
      const colSpan = 3 + (showComponents ? items.length : 0) + cplCols.length + 5;
      tbody.html(`<tr><td colspan="${colSpan}" style="text-align: center; color: #64748b; padding: 24px;">Tidak ada mahasiswa yang sesuai dengan kriteria filter.</td></tr>`);
      return;
    }

    // Hitung akumulasi untuk Footer
    const compSums = {};
    const compCounts = {};
    const cplSums = {};
    const cplPassCounts = {};
    const cplTotalCounts = {};
    let finalScoreSum = 0;
    let cplRateSum = 0;

    items.forEach(it => {
      compSums[it.id] = 0;
      compCounts[it.id] = 0;
    });

    cplCols.forEach(c => {
      cplSums[c.code] = 0;
      cplPassCounts[c.code] = 0;
      cplTotalCounts[c.code] = 0;
    });

    filtered.forEach((s, idx) => {
      finalScoreSum += s.final_score;
      cplRateSum += s.cpl_achievement_rate;

      let tr = `<tr style="border-bottom: 1px solid #e2e8f0;">`;
      tr += `<td style="text-align: center; color: #64748b;">${idx + 1}</td>`;
      tr += `<td style="font-weight: 600; color: #1e293b;">${escapeHtml(s.nim)}</td>`;
      tr += `<td style="font-weight: 600; color: #0f172a;">${escapeHtml(s.name)}</td>`;

      // 1. Kolom Komponen Butir Penilaian
      if (showComponents && items.length > 0) {
        items.forEach(it => {
          let score = undefined;
          if (s.item_scores) {
            score = s.item_scores[it.name] !== undefined ? s.item_scores[it.name] : s.item_scores[`item_${it.id}`];
          }

          // Fallback ke kolom standar jika tidak ada sub-item
          if (score === undefined) {
            if (it.category === 'tugas') score = s.assignment;
            else if (it.category === 'kuis') score = s.quiz;
            else if (it.category === 'uts') score = s.midterm;
            else if (it.category === 'uas') score = s.final_exam;
          }

          if (score !== undefined) {
            compSums[it.id] += score;
            compCounts[it.id]++;
            tr += `<td style="text-align: center; color: #334155; font-weight: 500;">${score.toFixed(1)}</td>`;
          } else {
            tr += `<td style="text-align: center; color: #94a3b8;">-</td>`;
          }
        });
      }

      // 2. Kolom CPL Mahasiswa
      cplCols.forEach(c => {
        const score = s.cpl_scores ? s.cpl_scores[c.code] : undefined;
        if (score !== undefined) {
          cplSums[c.code] += score;
          cplTotalCounts[c.code]++;

          const isPass = score >= (c.target_score || 70.0);
          if (isPass) {
            cplPassCounts[c.code]++;
          }

          const bg = isPass ? '#f0fdf4' : '#fef2f2';
          const color = isPass ? '#15803d' : '#b91c1c';
          const icon = isPass ? '✓' : '✗';

          tr += `<td style="text-align: center; background: ${bg}; color: ${color}; font-weight: 700; border-left: 1px solid #e2e8f0;" title="${c.code}: ${score.toFixed(1)} (${isPass ? 'Lulus Target' : 'Belum Lulus Target'})">
                  ${score.toFixed(1)} <span style="font-size: 0.72rem; opacity: 0.8;">${icon}</span>
                </td>`;
        } else {
          tr += `<td style="text-align: center; color: #94a3b8; border-left: 1px solid #e2e8f0;">-</td>`;
        }
      });

      // 3. % Ketercapaian CPL Mahasiswa
      const rateColor = s.cpl_achievement_rate >= 100 ? '#15803d' : (s.cpl_achievement_rate >= 75 ? '#2563eb' : '#b91c1c');
      const rateBg = s.cpl_achievement_rate >= 100 ? '#dcfce7' : (s.cpl_achievement_rate >= 75 ? '#dbeafe' : '#fee2e2');
      tr += `<td style="text-align: center;">
              <span style="background: ${rateBg}; color: ${rateColor}; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">
                ${s.cpl_achievement_rate.toFixed(0)}%
              </span>
             </td>`;

      // 4. Nilai Akhir & Predikat
      tr += `<td style="text-align: center; font-weight: 700; color: #0f172a; font-size: 0.9rem;">${s.final_score.toFixed(2)}</td>`;

      const safeGrade = (s.letter_grade || 'E').replace('/', '');
      tr += `<td style="text-align: center;"><span class="badge-grade badge-${safeGrade}">${escapeHtml(s.letter_grade)}</span></td>`;
      tr += `<td style="text-align: center; font-size: 0.8rem; color: #475569;">${escapeHtml(s.predicate)}</td>`;

      // 5. Status Kelulusan CPL
      const isAllCPLAchieved = s.cpl_achievement_rate >= 100.0;
      const statusBadge = isAllCPLAchieved
        ? '<span class="badge-cpl-success" style="font-size: 0.75rem; padding: 3px 8px;">Kompeten (100%)</span>'
        : `<span class="badge-cpl-danger" style="font-size: 0.75rem; padding: 3px 8px;">Remedial (${s.cpl_achieved_count}/${s.cpl_total_count})</span>`;
      tr += `<td style="text-align: center;">${statusBadge}</td>`;

      tr += `</tr>`;
      tbody.append(tr);
    });

    // ----------------------------------------------------
    // Render Footer (Statistik Agregat Kelas)
    // ----------------------------------------------------
    const n = filtered.length;
    const avgFinalScore = n > 0 ? (finalScoreSum / n) : 0;
    const avgCplRate = n > 0 ? (cplRateSum / n) : 0;

    let footRow1 = `<tr style="background: #f1f5f9; color: #0f172a; font-weight: 700; border-top: 2px solid #94a3b8;">`;
    footRow1 += `<td colspan="3" style="text-align: right; padding: 8px 12px;">RATA-RATA KELAS:</td>`;

    if (showComponents && items.length > 0) {
      items.forEach(it => {
        const count = compCounts[it.id] || 0;
        const avg = count > 0 ? (compSums[it.id] / count) : 0;
        footRow1 += `<td style="text-align: center; color: #2563eb;">${avg.toFixed(1)}</td>`;
      });
    }

    cplCols.forEach(c => {
      const count = cplTotalCounts[c.code] || 0;
      const avg = count > 0 ? (cplSums[c.code] / count) : 0;
      const isPass = avg >= (c.target_score || 70.0);
      const color = isPass ? '#15803d' : '#b91c1c';
      footRow1 += `<td style="text-align: center; color: ${color}; font-weight: 700;">${avg.toFixed(1)}</td>`;
    });

    footRow1 += `<td style="text-align: center; color: #2563eb;">${avgCplRate.toFixed(1)}%</td>`;
    footRow1 += `<td style="text-align: center; color: #0f172a; font-size: 0.95rem;">${avgFinalScore.toFixed(2)}</td>`;
    footRow1 += `<td colspan="3" style="text-align: center; color: #64748b; font-size: 0.8rem;">(Agregat ${n} Mahasiswa)</td>`;
    footRow1 += `</tr>`;

    // Baris % Kelulusan CPL di Footer
    let footRow2 = `<tr style="background: #e2e8f0; color: #1e293b; font-size: 0.78rem;">`;
    footRow2 += `<td colspan="3" style="text-align: right; padding: 6px 12px; font-weight: 700;">% KELULUSAN TARGET CPL (≥70):</td>`;

    if (showComponents && items.length > 0) {
      footRow2 += `<td colspan="${items.length}" style="text-align: center; color: #64748b;">-</td>`;
    }

    cplCols.forEach(c => {
      const total = cplTotalCounts[c.code] || 0;
      const pass = cplPassCounts[c.code] || 0;
      const passPercent = total > 0 ? ((pass / total) * 100) : 0;
      const color = passPercent >= 75.0 ? '#15803d' : '#b91c1c';
      footRow2 += `<td style="text-align: center; font-weight: 700; color: ${color};">
                    ${passPercent.toFixed(0)}%<br>
                    <span style="font-size: 0.7rem; font-weight: normal; color: #475569;">(${pass}/${total})</span>
                   </td>`;
    });

    footRow2 += `<td colspan="5" style="text-align: left; color: #475569; padding-left: 10px;">
                  Standar Akreditasi OBE: Target Ketercapaian Kelas ≥ 75%
                 </td>`;
    footRow2 += `</tr>`;

    tfoot.append(footRow1 + footRow2);
  }

  // ==========================================
  // 7. RENDER EVALUASI MUTU CPL (CQI)
  // ==========================================
  function renderCQISection(data) {
    const tbody = $('#cqiTableBody');
    const recList = $('#cqiRecommendationsList');
    tbody.empty();
    recList.empty();

    const recapList = data.cpl_recap || [];
    const cqiNotes = data.evaluation_cqi || [];

    if (recapList.length === 0) {
      tbody.html('<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 16px;">Belum ada CPL yang terhubung dengan penilaian.</td></tr>');
      recList.html('<p style="color: #64748b; margin: 0;">Belum ada data evaluasi CPL.</p>');
      return;
    }

    let failingCPLFound = false;
    let recommendationHTML = '<ul style="margin: 0; padding-left: 20px;">';

    recapList.forEach(item => {
      const isTargetMet = item.pass_rate >= 75.0 && item.total_assessed > 0;
      const statusBadge = isTargetMet
        ? '<span class="badge-cpl-success" style="font-size: 0.8rem; padding: 4px 10px;">✓ Memenuhi Target (≥75%)</span>'
        : (item.total_assessed > 0
          ? '<span class="badge-cpl-danger" style="font-size: 0.8rem; padding: 4px 10px;">⚠️ Perlu Evaluasi Mutu (&lt;75%)</span>'
          : '<span class="badge-cpl" style="font-size: 0.8rem; padding: 4px 10px;">Belum Dinilai</span>');

      const avgColor = item.average_score >= item.target_score ? '#15803d' : '#b91c1c';

      let tr = `<tr style="border-bottom: 1px solid #e2e8f0;">`;
      tr += `<td style="font-weight: 700; color: #0284c7;"><span class="badge-cpl">${escapeHtml(item.cpl_code)}</span></td>`;
      tr += `<td style="color: #1e293b;">${escapeHtml(item.cpl_desc)}</td>`;
      tr += `<td style="text-align: center; font-weight: 600; color: #475569;">${item.target_score.toFixed(1)}</td>`;
      tr += `<td style="text-align: center; font-weight: 700; color: ${avgColor};">${item.average_score.toFixed(2)}</td>`;
      tr += `<td style="text-align: center; color: #334155;">${item.achieved_count} / ${item.total_assessed}</td>`;
      tr += `<td style="text-align: center; font-weight: 700; color: ${isTargetMet ? '#15803d' : '#b91c1c'};">${item.pass_rate.toFixed(1)}%</td>`;
      tr += `<td style="text-align: center;">${statusBadge}</td>`;
      tr += `</tr>`;
      tbody.append(tr);

      // Rekomendasi CQI khusus untuk CPL yang perlu perhatian
      if (!isTargetMet && item.total_assessed > 0) {
        failingCPLFound = true;
        const failingStudentsText = item.failing_students && item.failing_students.length > 0
          ? item.failing_students.join(', ')
          : '-';

        recommendationHTML += `<li style="margin-bottom: 8px;">
          <strong style="color: #b91c1c;">[Perhatian Mutu] ${escapeHtml(item.cpl_code)} (${escapeHtml(item.cpl_desc)}):</strong>
          Tingkat kelulusan kelas hanya <strong>${item.pass_rate.toFixed(1)}%</strong> dengan nilai rata-rata <strong>${item.average_score.toFixed(2)}</strong> (di bawah target minimal 70.00).
          <div style="font-size: 0.83rem; color: #475569; margin-top: 3px;">
            • <em>Mahasiswa yang belum lulus:</em> ${escapeHtml(failingStudentsText)}.<br>
            • <em>Rekomendasi Tindak Lanjut:</em> Disarankan mengadakan program tutorial/remedial tambahan sebelum semester berakhir serta peninjauan ulang butir asesmen tugas/ujian terkait.
          </div>
        </li>`;
      }
    });

    if (!failingCPLFound) {
      recommendationHTML += `<li style="color: #15803d; font-weight: 600;">
        🎉 Seluruh Capaian Pembelajaran Lulusan (CPL) pada mata kuliah ini berhasil memenuhi standar mutu OBE (Tingkat ketercapaian kelas ≥ 75%).
        <div style="font-size: 0.83rem; color: #475569; font-weight: normal; margin-top: 2px;">
          Metode pembelajaran dan rancangan asesmen yang diterapkan dinilai sangat efektif untuk dilanjutkan pada periode perkuliahan berikutnya.
        </div>
      </li>`;
    }

    recommendationHTML += '</ul>';
    recList.html(recommendationHTML);
  }

  // ==========================================
  // 8. EXPORT CSV / EXCEL
  // ==========================================
  function exportToCSV() {
    if (!currentRecapData || !currentRecapData.student_matrix || currentRecapData.student_matrix.length === 0) {
      alert('Tidak ada data rekapitulasi nilai untuk diunduh.');
      return;
    }

    const course = currentRecapData.course || {};
    const items = currentRecapData.assessment_items || [];
    const cplCols = currentRecapData.cpl_columns || [];
    const students = currentRecapData.student_matrix || [];

    let csvContent = '\uFEFF'; // BOM UTF-8

    // Metadata Laporan
    csvContent += `LAPORAN REKAPITULASI HASIL PENILAIAN MAHASISWA OBE\r\n`;
    csvContent += `Mata Kuliah,"${(course.name || '').replace(/"/g, '""')}"\r\n`;
    csvContent += `Kode,"${course.code || ''}",SKS,"${course.credits || 0}"\r\n`;
    csvContent += `Tanggal Cetak,"${new Date().toLocaleDateString('id-ID')}"\r\n\r\n`;

    // Header Kolom
    const headers = ['No', 'NIM', 'Nama Mahasiswa'];
    items.forEach(it => {
      headers.push(`${it.name} (${it.weight}%)`);
    });
    cplCols.forEach(c => {
      headers.push(`${c.code} (Target ${c.target_score || 70})`);
    });
    headers.push('% Ketercapaian CPL');
    headers.push('Nilai Akhir');
    headers.push('Grade');
    headers.push('Predikat');
    headers.push('Status Kelulusan');

    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';

    // Baris Mahasiswa
    students.forEach((s, idx) => {
      const row = [idx + 1, s.nim, s.name];

      // Komponen
      items.forEach(it => {
        let score = s.item_scores ? (s.item_scores[it.name] !== undefined ? s.item_scores[it.name] : s.item_scores[`item_${it.id}`]) : undefined;
        if (score === undefined) {
          if (it.category === 'tugas') score = s.assignment;
          else if (it.category === 'kuis') score = s.quiz;
          else if (it.category === 'uts') score = s.midterm;
          else if (it.category === 'uas') score = s.final_exam;
        }
        row.push(score !== undefined ? score.toFixed(1) : '-');
      });

      // CPL
      cplCols.forEach(c => {
        const sc = s.cpl_scores ? s.cpl_scores[c.code] : undefined;
        row.push(sc !== undefined ? sc.toFixed(1) : '-');
      });

      // Ringkasan
      row.push(`${s.cpl_achievement_rate.toFixed(0)}%`);
      row.push(s.final_score.toFixed(2));
      row.push(s.letter_grade);
      row.push(s.predicate);
      row.push(s.cpl_achievement_rate >= 100 ? 'Kompeten' : 'Remedial');

      csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\r\n';
    });

    // Buat trigger unduhan
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeCode = (course.code || 'MK').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `Rekap_Nilai_OBE_${safeCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==========================================
  // 9. PERSIAPAN CETAK RESMI (PRINT REPORT)
  // ==========================================
  function prepareAndPrint() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = today.toLocaleDateString('id-ID', options);

    $('#printMetaDate').text(`Dicetak pada: ${dateStr}`);
    $('#printSignDate').html(`Semarang, ${dateStr}<br><strong>Dosen Pengampu Mata Kuliah</strong>`);

    if (currentUser) {
      $('#printLecturerName').text(currentUser.name || currentUser.username || '(_________________________)');
    }

    // Pastikan seluruh butir komponen terbuka saat dicetak
    const prevChecked = $('#chkShowComponents').is(':checked');
    $('#chkShowComponents').prop('checked', true);
    if (currentRecapData) {
      renderMatrixHeader(currentRecapData);
      filterAndRenderMatrix();
    }

    setTimeout(function () {
      window.print();
      // Kembalikan status checkbox jika sebelumnya dimatikan
      if (!prevChecked) {
        $('#chkShowComponents').prop('checked', false);
        if (currentRecapData) {
          renderMatrixHeader(currentRecapData);
          filterAndRenderMatrix();
        }
      }
    }, 250);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});

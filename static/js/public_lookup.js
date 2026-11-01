$(document).ready(function () {
  let chartStudentRadarInstance = null;
  let chartStudentCoursesInstance = null;
  let chartStudentGradesInstance = null;

  // 1. Muat Sampel NIM untuk Chip Shortcut
  loadSampleNIMs();

  // 2. Periksa apakah ada parameter ?nim= di URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramNIM = urlParams.get('nim');
  if (paramNIM && paramNIM.trim() !== '') {
    $('#inputSearchNIM').val(paramNIM.trim());
    $('#btnClearSearch').show();
    performSearch(paramNIM.trim());
  }

  // 3. Event Handlers
  $('#publicSearchForm').on('submit', function (e) {
    e.preventDefault();
    const nim = $('#inputSearchNIM').val().trim();
    if (!nim) {
      showPublicAlert('Silakan masukkan Nomor Induk Mahasiswa (NIM) yang ingin dicari.', 'danger');
      return false;
    }
    performSearch(nim);
    return false;
  });

  $('#inputSearchNIM').on('input', function () {
    if ($(this).val().trim().length > 0) {
      $('#btnClearSearch').show();
    } else {
      $('#btnClearSearch').hide();
    }
  });

  $('#btnClearSearch').on('click', function () {
    $('#inputSearchNIM').val('').focus();
    $(this).hide();
    $('#stateResults').hide();
    $('#stateInitial').show();
    history.pushState(null, '', window.location.pathname);
  });

  $('#btnPrintStudentReport').on('click', function () {
    prepareAndPrintStudentReport();
  });

  // Delegasi klik chip sampel NIM
  $(document).on('click', '.btn-sample-nim-chip', function () {
    const nim = $(this).data('nim');
    if (nim) {
      $('#inputSearchNIM').val(nim);
      $('#btnClearSearch').show();
      performSearch(nim);
    }
  });

  // ==========================================
  // 1. FUNGSI MEMUAT SAMPEL NIM
  // ==========================================
  function loadSampleNIMs() {
    $.ajax({
      url: '/api/public/sample-nims',
      type: 'GET',
      success: function (res) {
        const samples = res.data || [];
        const chipsContainer = $('#sampleNIMChips');
        chipsContainer.empty();

        if (samples.length === 0) {
          chipsContainer.html('<span style="font-size: 0.8rem; color: #94a3b8;">Belum ada data mahasiswa terdaftar.</span>');
          return;
        }

        samples.forEach(s => {
          chipsContainer.append(`
            <button type="button" class="btn-sample-nim-chip" data-nim="${escapeHtml(s.nim)}" title="${escapeHtml(s.name)} (${escapeHtml(s.major)})">
              ${escapeHtml(s.nim)} • ${escapeHtml(s.name.split(' ')[0])}
            </button>
          `);
        });
      },
      error: function () {
        $('#sampleNIMChips').html('<span style="font-size: 0.8rem; color: #cbd5e1;">(Coba: 240101, 240102)</span>');
      }
    });
  }

  // ==========================================
  // 2. FUNGSI PENCARIAN MAHASISWA BERDASARKAN NIM
  // ==========================================
  function performSearch(nim) {
    if (!nim) return;

    // Sembunyikan alert & state lama, tampilkan loading
    $('#publicAlert').hide();
    $('#stateInitial').hide();
    $('#stateResults').hide();
    $('#stateLoading').fadeIn(150);

    // Update query param URL
    try {
      history.pushState(null, '', `?nim=${encodeURIComponent(nim)}`);
    } catch (e) {}

    $.ajax({
      url: `/api/public/student-grades?nim=${encodeURIComponent(nim)}`,
      type: 'GET',
      success: function (res) {
        $('#stateLoading').hide();
        renderStudentResults(res);
        $('#stateResults').fadeIn(250);

        // Scroll halus ke kartu hasil
        $('html, body').animate({
          scrollTop: $('#stateResults').offset().top - 80
        }, 300);
      },
      error: function (xhr) {
        $('#stateLoading').hide();
        $('#stateInitial').fadeIn(150);

        let errorMsg = 'Gagal mencari data mahasiswa.';
        let samplesHTML = '';
        if (xhr.responseJSON) {
          errorMsg = xhr.responseJSON.error || errorMsg;
          if (xhr.responseJSON.available_samples && xhr.responseJSON.available_samples.length > 0) {
            const list = xhr.responseJSON.available_samples
              .map(s => `<button type="button" class="btn-sample-nim-chip" data-nim="${escapeHtml(s.nim)}" style="margin-top:6px;">${escapeHtml(s.nim)} (${escapeHtml(s.name)})</button>`)
              .join(' ');
            samplesHTML = `<div style="margin-top: 10px; font-size: 0.85rem;"><strong>NIM yang tersedia di database:</strong><br>${list}</div>`;
          }
        }

        showPublicAlert(`<strong>Pencarian Tidak Ditemukan:</strong> ${errorMsg}${samplesHTML}`, 'danger', 9000);
      }
    });
  }

  // ==========================================
  // 3. RENDER DATA HASIL PENCARIAN
  // ==========================================
  function renderStudentResults(data) {
    const student = data.student || {};
    const summary = data.summary || {};
    const courses = data.courses || [];
    const radarData = data.cpl_radar || [];

    // Profil Mahasiswa
    $('#resStudentName').text(student.name || '-');
    $('#resStudentNIM').text(student.nim || '-');
    $('#resStudentMajor').text(student.major || '-');
    $('#resCurriculumBadge').text(student.curriculum || 'Kurikulum OBE');

    // KPI IPK & Rata-rata
    const ipk = summary.ipk || 0.0;
    const avgScore = summary.average_final_score || 0.0;
    const totalCourses = summary.total_courses || 0;
    const totalCredits = summary.total_credits || 0;
    const cplRate = summary.cpl_pass_rate || 0.0;
    const cplEvaluated = summary.cpl_evaluated || 0;
    const cplAchieved = summary.cpl_achieved || 0;
    const isAllAchieved = summary.cpl_is_all_achieved;

    $('#resKPIIPK').text(ipk.toFixed(2));
    const predicate = summary.academic_predicate || '-';
    $('#resKPIPredicateText').text(predicate);
    $('#resKPIPredicateBadge').text(ipk >= 3.0 ? 'LULUS' : 'EVALUASI');

    $('#resKPIAvgScore').text(avgScore.toFixed(2));
    $('#resKPICoursesAndCredits').text(`${totalCourses} Mata Kuliah (${totalCredits} SKS Total)`);

    $('#resKPICPLRate').text(`${cplRate.toFixed(1)}%`);
    $('#resKPICPLCounts').text(`${cplAchieved} dari ${cplEvaluated} Indikator CPL Lulus (≥70)`);

    if (isAllAchieved) {
      $('#resKPIStatusBadge').html('<span class="badge-cpl-success" style="font-size: 1rem; padding: 5px 12px;">✓ KOMPETEN PENUH (100%)</span>');
      $('#resKPIStatusDesc').text('Seluruh CPL yang diukur berhasil dicapai.');
    } else if (cplEvaluated > 0) {
      $('#resKPIStatusBadge').html('<span class="badge-cpl-danger" style="font-size: 1rem; padding: 5px 12px;">⚠️ PERLU REMEDIAL</span>');
      $('#resKPIStatusDesc').text(`Terdapat ${cplEvaluated - cplAchieved} CPL yang belum mencapai batas minimal 70.0.`);
    } else {
      $('#resKPIStatusBadge').text('Belum Dinilai');
      $('#resKPIStatusDesc').text('Belum ada data evaluasi CPL.');
    }

    // 4. Render Grafik
    renderStudentCharts(data);

    // 5. Render Detail Kartu Mata Kuliah
    renderCoursesDetail(courses);
  }

  // ==========================================
  // 4. RENDER VISUAL CHARTS (CHART.JS)
  // ==========================================
  function renderStudentCharts(data) {
    const radarData = data.cpl_radar || [];
    const courses = data.courses || [];
    const dist = (data.summary && data.summary.grade_distribution) || {};

    // ----------------------------------------------------
    // Chart 1: Radar Chart Ketercapaian CPL Mahasiswa
    // ----------------------------------------------------
    if (chartStudentRadarInstance) {
      chartStudentRadarInstance.destroy();
    }

    const radarLabels = radarData.map(r => r.code);
    const radarScores = radarData.map(r => r.average_score);
    const radarTargets = radarData.map(() => 70.0);

    const ctx1 = document.getElementById('chartStudentRadar');
    if (ctx1 && radarLabels.length > 0) {
      chartStudentRadarInstance = new Chart(ctx1.getContext('2d'), {
        type: 'radar',
        data: {
          labels: radarLabels,
          datasets: [
            {
              label: 'Nilai CPL Mahasiswa',
              data: radarScores,
              backgroundColor: 'rgba(2, 132, 199, 0.25)',
              borderColor: '#0284c7',
              pointBackgroundColor: '#0284c7',
              pointBorderColor: '#ffffff',
              pointHoverBackgroundColor: '#ffffff',
              pointHoverBorderColor: '#0284c7',
              borderWidth: 2
            },
            {
              label: 'Standar Target OBE (70.0)',
              data: radarTargets,
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              borderColor: '#ef4444',
              borderDash: [5, 4],
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
              labels: { boxWidth: 12, font: { size: 10 } }
            },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw;
                  return `${ctx.dataset.label}: ${val.toFixed(1)}`;
                }
              }
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

    // ----------------------------------------------------
    // Chart 2: Bar Chart Nilai Akhir per Mata Kuliah
    // ----------------------------------------------------
    if (chartStudentCoursesInstance) {
      chartStudentCoursesInstance.destroy();
    }

    const courseLabels = courses.map(c => c.course_code || c.course_name);
    const courseScores = courses.map(c => c.final_score);
    const courseColors = courseScores.map(s => s >= 70 ? '#10b981' : '#f59e0b');

    const ctx2 = document.getElementById('chartStudentCourses');
    if (ctx2 && courseLabels.length > 0) {
      chartStudentCoursesInstance = new Chart(ctx2.getContext('2d'), {
        type: 'bar',
        data: {
          labels: courseLabels,
          datasets: [
            {
              label: 'Nilai Akhir (0-100)',
              data: courseScores,
              backgroundColor: courseColors,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: courseColors
            },
            {
              label: 'Target Lulus (70)',
              data: courseScores.map(() => 70),
              type: 'line',
              borderColor: '#ef4444',
              borderDash: [5, 4],
              borderWidth: 1.5,
              pointRadius: 0,
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
              labels: { boxWidth: 12, font: { size: 10 } }
            },
            tooltip: {
              callbacks: {
                afterLabel: function (ctx) {
                  const idx = ctx.dataIndex;
                  const c = courses[idx];
                  if (c && ctx.datasetIndex === 0) {
                    return `Grade: ${c.letter_grade} (${c.predicate}) • CPL: ${c.cpl_achievement_rate.toFixed(0)}%`;
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
    // Chart 3: Doughnut Chart Sebaran Nilai Huruf
    // ----------------------------------------------------
    if (chartStudentGradesInstance) {
      chartStudentGradesInstance.destroy();
    }

    const gradeKeys = ['A', 'AB', 'B', 'BC', 'C', 'D', 'E'];
    const gradeCounts = gradeKeys.map(k => dist[k] || 0);
    const gradePalette = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#ef4444'];

    const ctx3 = document.getElementById('chartStudentGrades');
    if (ctx3) {
      chartStudentGradesInstance = new Chart(ctx3.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: gradeKeys,
          datasets: [
            {
              data: gradeCounts,
              backgroundColor: gradePalette,
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
              labels: { boxWidth: 10, font: { size: 10 } }
            }
          },
          cutout: '62%'
        }
      });
    }
  }

  // ==========================================
  // 5. RENDER RINCIAN KARTU MATA KULIAH
  // ==========================================
  function renderCoursesDetail(courses) {
    const container = $('#coursesDetailContainer');
    container.empty();

    $('#resCourseCountBadge').text(`${courses.length} Mata Kuliah Terdaftar`);

    if (courses.length === 0) {
      container.html(`
        <div class="card" style="text-align: center; color: #64748b; padding: 24px;">
          Belum ada rekaman nilai mata kuliah untuk mahasiswa ini.
        </div>
      `);
      return;
    }

    courses.forEach((c, idx) => {
      const safeGrade = (c.letter_grade || 'E').replace('/', '');
      const isPassedCourse = c.final_score >= 70.0;
      const isCPLComplete = c.cpl_achievement_rate >= 100.0;

      let card = `
        <div class="card course-grade-card" style="border-left: 5px solid ${isPassedCourse ? '#10b981' : '#f59e0b'}; padding: 18px 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 16px;">
          <!-- Header Baris Mata Kuliah -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="badge-cpl" style="font-size: 0.82rem; font-weight: 700;">${escapeHtml(c.course_code)}</span>
                <h4 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">${escapeHtml(c.course_name)}</h4>
                <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">(${c.credits} SKS)</span>
              </div>
              <div style="font-size: 0.82rem; color: #64748b; margin-top: 4px;">
                Status Kompetensi: <strong>${c.cpl_achieved_count} dari ${c.cpl_total_count} CPL Tercapai (${c.cpl_achievement_rate.toFixed(0)}%)</strong>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="text-align: right;">
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">NILAI AKHIR</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #0f172a;">${c.final_score.toFixed(2)}</div>
              </div>
              <span class="badge-grade badge-${safeGrade}" style="font-size: 1rem; padding: 6px 14px; border-radius: 6px;">${escapeHtml(c.letter_grade)}</span>
              <div style="font-size: 0.82rem; font-weight: 600; color: #334155; min-width: 80px;">${escapeHtml(c.predicate)}</div>
            </div>
          </div>

          <!-- Bagian 1: Butir Komponen Penilaian -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
              📝 Butir Komponen Evaluasi Akademik (Total 100%):
            </div>
            <div class="table-responsive" style="border: 1px solid #e2e8f0; border-radius: 6px;">
              <table style="width: 100%; font-size: 0.82rem; margin: 0;">
                <thead style="background: #f8fafc;">
                  <tr>
                    <th style="padding: 7px 10px;">Komponen</th>
                    <th style="padding: 7px 10px; width: 100px; text-align: center;">Bobot (%)</th>
                    <th style="padding: 7px 10px; width: 120px; text-align: center;">CPL Terkait</th>
                    <th style="padding: 7px 10px; width: 110px; text-align: center;">Nilai Mahasiswa</th>
                    <th style="padding: 7px 10px; width: 130px; text-align: center;">Kontribusi Bobot</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (c.items && c.items.length > 0) {
        c.items.forEach(it => {
          const contrib = (it.score * it.weight) / 100;
          card += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 7px 10px; font-weight: 600; color: #1e293b;">${escapeHtml(it.name)}</td>
              <td style="padding: 7px 10px; text-align: center; color: #2563eb; font-weight: 700;">${it.weight}%</td>
              <td style="padding: 7px 10px; text-align: center;"><span class="badge-cpl" style="font-size: 0.75rem;">${escapeHtml(it.cpl_code)}</span></td>
              <td style="padding: 7px 10px; text-align: center; font-weight: 700; color: #0f172a;">${it.score.toFixed(1)}</td>
              <td style="padding: 7px 10px; text-align: center; color: #15803d; font-weight: 600;">+${contrib.toFixed(2)}</td>
            </tr>
          `;
        });
      } else {
        // Fallback standar 4 komponen jika sub-items belum diset
        const comps = [
          { name: 'Tugas', score: c.assignment, weight: 20 },
          { name: 'Kuis', score: c.quiz, weight: 15 },
          { name: 'UTS', score: c.midterm, weight: 25 },
          { name: 'UAS', score: c.final_exam, weight: 40 }
        ];
        comps.forEach(cp => {
          const contrib = (cp.score * cp.weight) / 100;
          card += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 7px 10px; font-weight: 600;">${cp.name}</td>
              <td style="padding: 7px 10px; text-align: center; color: #2563eb; font-weight: 700;">${cp.weight}%</td>
              <td style="padding: 7px 10px; text-align: center;">-</td>
              <td style="padding: 7px 10px; text-align: center; font-weight: 700;">${cp.score.toFixed(1)}</td>
              <td style="padding: 7px 10px; text-align: center; color: #15803d; font-weight: 600;">+${contrib.toFixed(2)}</td>
            </tr>
          `;
        });
      }

      card += `
                </tbody>
              </table>
            </div>
          </div>

          <!-- Bagian 2: Ketercapaian CPL Mata Kuliah -->
          <div>
            <div style="font-size: 0.8rem; font-weight: 700; color: #0369a1; text-transform: uppercase; margin-bottom: 6px;">
              🎯 Ketercapaian Capaian Pembelajaran Lulusan (CPL Target Minimal &ge; 70.0):
            </div>
            <div class="table-responsive" style="border: 1px solid #bae6fd; border-radius: 6px;">
              <table style="width: 100%; font-size: 0.82rem; margin: 0;">
                <thead style="background: #f0f9ff; color: #0369a1;">
                  <tr>
                    <th style="padding: 7px 10px; width: 110px;">Kode CPL</th>
                    <th style="padding: 7px 10px;">Deskripsi Capaian Pembelajaran</th>
                    <th style="padding: 7px 10px; width: 100px; text-align: center;">Target Min</th>
                    <th style="padding: 7px 10px; width: 110px; text-align: center;">Nilai Capaian</th>
                    <th style="padding: 7px 10px; width: 140px; text-align: center;">Status Ketercapaian</th>
                  </tr>
                </thead>
                <tbody>
      `;

      if (c.cpl_details && c.cpl_details.length > 0) {
        c.cpl_details.forEach(cd => {
          const isPassed = cd.score >= (cd.target_score || 70.0);
          const bg = isPassed ? '#f0fdf4' : '#fef2f2';
          const color = isPassed ? '#15803d' : '#b91c1c';
          const badge = isPassed
            ? '<span class="badge-cpl-success" style="font-size: 0.75rem; padding: 3px 8px;">✓ Tercapai (&ge;70)</span>'
            : '<span class="badge-cpl-danger" style="font-size: 0.75rem; padding: 3px 8px;">✗ Belum Tercapai</span>';

          card += `
            <tr style="border-bottom: 1px solid #e0f2fe; background: ${bg};">
              <td style="padding: 7px 10px; font-weight: 700; color: #0284c7;"><span class="badge-cpl">${escapeHtml(cd.cpl_code)}</span></td>
              <td style="padding: 7px 10px; color: #1e293b;">${escapeHtml(cd.cpl_desc)}</td>
              <td style="padding: 7px 10px; text-align: center; color: #475569; font-weight: 600;">${cd.target_score.toFixed(1)}</td>
              <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: ${color}; font-size: 0.9rem;">${cd.score.toFixed(1)}</td>
              <td style="padding: 7px 10px; text-align: center;">${badge}</td>
            </tr>
          `;
        });
      } else {
        card += `
          <tr>
            <td colspan="5" style="text-align: center; color: #64748b; padding: 10px;">
              Belum ada pemetaan CPL untuk mata kuliah ini.
            </td>
          </tr>
        `;
      }

      card += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      container.append(card);
    });
  }

  // ==========================================
  // 6. HELPER CETAK KHS / PDF
  // ==========================================
  function prepareAndPrintStudentReport() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = today.toLocaleDateString('id-ID', options);

    $('#printReportDate').text(`Tanggal Cetak: ${dateStr}`);
    $('#printSignDate').html(`Semarang, ${dateStr}<br><strong>Dosen Pembimbing Akademik</strong>`);

    setTimeout(function () {
      window.print();
    }, 200);
  }

  // Helper Alert Publik
  function showPublicAlert(message, type = 'danger', duration = 6000) {
    const box = $('#publicAlert');
    box.removeClass('alert-success alert-danger')
      .addClass(type === 'success' ? 'alert-success' : 'alert-danger')
      .html(message)
      .fadeIn();

    setTimeout(() => {
      box.fadeOut();
    }, duration);
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

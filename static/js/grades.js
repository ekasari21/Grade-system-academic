$(document).ready(function () {
  let courseCPLMap = {}; // Cache CPL per mata kuliah: { [courseId]: [cpls] }
  let gradesData = [];    // Cache data penilaian yang sedang dimuat
  let coursesList = [];   // Cache daftar mata kuliah
  let currentItems = [];  // Butir penilaian yang sedang aktif di modal form

  // Variabel State untuk Input Nilai Serentak (Matriks OBE)
  let batchCourseId = null;
  let batchAssessmentItems = [];
  let batchCourseCPLs = [];
  let batchStudentsList = [];
  let batchExistingGrades = [];

  initAuth().done(function () {
    loadFilterOptions();
    loadGrades();

    // Inisialisasi Tab Navigasi & Mode Penilaian Serentak
    initTabsAndBatch();
  });

  // Inisialisasi Navigasi Tab
  function initTabsAndBatch() {
    $('.nav-tab-btn').on('click', function () {
      $('.nav-tab-btn').removeClass('active');
      $(this).addClass('active');

      const targetPane = $(this).data('target');
      $('.tab-pane').removeClass('active').hide();
      $(targetPane).addClass('active').fadeIn(150);

      if (targetPane === '#tabGradeList') {
        loadGrades();
      } else if (targetPane === '#tabBatchGrading') {
        if (!batchCourseId && coursesList.length > 0) {
          loadBatchCourses();
        }
      }
    });

    if (currentUser && currentUser.role === 'mahasiswa') {
      $('.dosen-admin-only').hide();
      $('.nav-tab-btn').removeClass('active');
      $('.tab-pane').removeClass('active').hide();
      $('#tabGradeList').addClass('active').show();
    } else {
      loadBatchCourses();
    }
  }

  // Muat opsi dropdown filter, modal input, modal simulasi, dan modal rekap
  function loadFilterOptions() {
    $.ajax({
      url: '/api/private/courses',
      type: 'GET',
      success: function (res) {
        coursesList = res.data || [];
        const filterCourse = $('#filterCourse');
        const inputCourse = $('#gradeCourseId');
        const simCourse = $('#selectSimCourse');
        const recapCourse = $('#selectRecapCourse');

        filterCourse.find('option:not(:first)').remove();
        inputCourse.find('option:not(:first)').remove();
        simCourse.empty();
        recapCourse.empty();

        coursesList.forEach(c => {
          filterCourse.append(`<option value="${c.id}">${c.code} - ${c.name}</option>`);
          inputCourse.append(`<option value="${c.id}">${c.code} - ${c.name} (${c.credits} SKS)</option>`);
          simCourse.append(`<option value="${c.id}">${c.code} - ${c.name}</option>`);
          recapCourse.append(`<option value="${c.id}">${c.code} - ${c.name}</option>`);
          if (c.cpls) {
            courseCPLMap[c.id] = c.cpls;
          }
        });

        // Jika batch course dropdown belum terisi, isi sekarang
        if ($('#batchCourseSelect option').length <= 1 && coursesList.length > 0) {
          populateBatchCourseDropdown();
        }
      }
    });

    $.ajax({
      url: '/api/private/students',
      type: 'GET',
      success: function (res) {
        const inputStudent = $('#gradeStudentId');
        inputStudent.find('option:not(:first)').remove();

        (res.data || []).forEach(s => {
          inputStudent.append(`<option value="${s.id}">${s.nim} - ${s.name}</option>`);
        });
      }
    });
  }

  // Muat data CPL dari server jika belum ada di cache
  function loadCPLsForCourse(courseId, callback) {
    if (!courseId) {
      if (callback) callback([]);
      return;
    }
    if (courseCPLMap[courseId] && courseCPLMap[courseId].length > 0) {
      if (callback) callback(courseCPLMap[courseId]);
      return;
    }

    $.ajax({
      url: `/api/private/courses/${courseId}/cpls`,
      type: 'GET',
      success: function (res) {
        const cpls = res.data || [];
        courseCPLMap[courseId] = cpls;
        if (callback) callback(cpls);
      },
      error: function () {
        if (callback) callback([]);
      }
    });
  }

  // Helper untuk membuat opsi dropdown CPL
  function generateCPLOptions(cpls, selectedId) {
    if (!cpls || cpls.length === 0) {
      return '<option value="">(Belum ada CPL)</option>';
    }
    return cpls.map(c => {
      const isSel = (c.id === selectedId) ? 'selected' : '';
      const shortDesc = c.description.length > 28 ? c.description.substring(0, 28) + '...' : c.description;
      return `<option value="${c.id}" ${isSel} data-code="${c.code}" data-desc="${c.description}" data-target="${c.target_score}">${c.code} (${shortDesc})</option>`;
    }).join('');
  }

  // Render baris butir penilaian ke dalam tabel modal
  function renderItemRows(items) {
    const courseId = $('#gradeCourseId').val();
    const cpls = courseCPLMap[courseId] || [];
    const tbody = $('#itemsTableBody');
    tbody.empty();

    if (!items || items.length === 0) {
      tbody.html('<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 12px;">Belum ada butir penilaian. Klik tombol template atau <strong>➕ Tambah Butir</strong> di atas.</td></tr>');
      updateModalScorePreview();
      return;
    }

    items.forEach((item, idx) => {
      const cplOptions = generateCPLOptions(cpls, item.cpl_id);
      const catVal = (item.category || 'tugas').toLowerCase();

      tbody.append(`
        <tr class="item-row" data-index="${idx}">
          <td>
            <input type="text" class="form-control form-control-sm item-name" value="${item.name || ''}" placeholder="Nama butir penilaian" required>
          </td>
          <td>
            <select class="form-control form-control-sm item-category">
              <option value="tugas" ${catVal === 'tugas' ? 'selected' : ''}>Tugas</option>
              <option value="kuis" ${catVal === 'kuis' ? 'selected' : ''}>Kuis</option>
              <option value="uts" ${catVal === 'uts' ? 'selected' : ''}>UTS</option>
              <option value="uas" ${catVal === 'uas' ? 'selected' : ''}>UAS</option>
              <option value="praktikum" ${catVal === 'praktikum' ? 'selected' : ''}>Praktikum</option>
              <option value="proyek" ${catVal === 'proyek' ? 'selected' : ''}>Proyek</option>
              <option value="presentasi" ${catVal === 'presentasi' ? 'selected' : ''}>Presentasi</option>
              <option value="keaktifan" ${catVal === 'keaktifan' ? 'selected' : ''}>Keaktifan</option>
              <option value="lainnya" ${catVal === 'lainnya' ? 'selected' : ''}>Lainnya</option>
            </select>
          </td>
          <td>
            <select class="form-control form-control-sm item-cpl" required>
              ${cplOptions}
            </select>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input type="number" step="0.5" min="0" max="100" class="form-control form-control-sm item-weight" value="${item.weight !== undefined ? item.weight : 20}" required>
              <span style="font-size: 0.75rem; color: #64748b;">%</span>
            </div>
          </td>
          <td>
            <input type="number" step="0.01" min="0" max="100" class="form-control form-control-sm item-score" value="${item.score !== undefined ? item.score : 0}" required>
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-sm btn-delete-item" title="Hapus butir ini" style="padding: 2px 7px; font-size: 0.75rem;">🗑️</button>
          </td>
        </tr>
      `);
    });

    updateModalScorePreview();
  }

  // Ambil data butir dari DOM tabel form saat ini
  function getItemsFromDOM() {
    const items = [];
    $('#itemsTableBody tr.item-row').each(function () {
      const row = $(this);
      const name = row.find('.item-name').val().trim() || 'Butir Penilaian';
      const category = row.find('.item-category').val() || 'tugas';
      const cplId = parseInt(row.find('.item-cpl').val(), 10) || null;
      const weight = parseFloat(row.find('.item-weight').val()) || 0;
      const score = parseFloat(row.find('.item-score').val()) || 0;

      items.push({
        name: name,
        category: category,
        cpl_id: cplId,
        weight: weight,
        score: score
      });
    });
    return items;
  }

  // Pasang template Contoh Kasus Pengguna (Tugas 20%, Kuis 15%, UTS 25%, UAS-A 20%, UAS-B 20%)
  function applyUserExamplePreset() {
    const courseId = $('#gradeCourseId').val();
    const cpls = courseCPLMap[courseId] || [];

    let cpl02Id = null, cpl03Id = null, cpl04Id = null, cpl05Id = null;
    cpls.forEach(c => {
      if (c.code === 'CPL-02' || c.code === 'CPL-2') cpl02Id = c.id;
      if (c.code === 'CPL-03' || c.code === 'CPL-3') cpl03Id = c.id;
      if (c.code === 'CPL-04' || c.code === 'CPL-4') cpl04Id = c.id;
      if (c.code === 'CPL-05' || c.code === 'CPL-5') cpl05Id = c.id;
    });

    if (!cpl02Id && cpls.length > 0) cpl02Id = cpls[0].id;
    if (!cpl03Id && cpls.length > 1) cpl03Id = cpls[1].id;
    if (!cpl04Id && cpls.length > 2) cpl04Id = cpls[2].id;
    if (!cpl05Id && cpls.length > 3) cpl05Id = cpls[3].id;

    currentItems = [
      { name: 'Tugas', category: 'tugas', cpl_id: cpl03Id || (cpls[0] ? cpls[0].id : null), weight: 20, score: 85 },
      { name: 'Kuis', category: 'kuis', cpl_id: cpl02Id || (cpls[0] ? cpls[0].id : null), weight: 15, score: 80 },
      { name: 'UTS', category: 'uts', cpl_id: cpl04Id || (cpls[0] ? cpls[0].id : null), weight: 25, score: 75 },
      { name: 'UAS bagian A', category: 'uas', cpl_id: cpl04Id || (cpls[0] ? cpls[0].id : null), weight: 20, score: 80 },
      { name: 'UAS bagian B', category: 'uas', cpl_id: cpl05Id || (cpls[0] ? cpls[0].id : null), weight: 20, score: 90 }
    ];

    renderItemRows(currentItems);
  }

  // Pasang template Multiple Tugas & Kuis (8 butir)
  function applyMultiTaskPreset() {
    const courseId = $('#gradeCourseId').val();
    const cpls = courseCPLMap[courseId] || [];

    const c1 = cpls[0] ? cpls[0].id : null;
    const c2 = cpls[1] ? cpls[1].id : c1;
    const c3 = cpls[2] ? cpls[2].id : c2;
    const c4 = cpls[3] ? cpls[3].id : c3;

    currentItems = [
      { name: 'Tugas 1 (Teori Dasar)', category: 'tugas', cpl_id: c1, weight: 10, score: 85 },
      { name: 'Tugas 2 (Analisis Kasus)', category: 'tugas', cpl_id: c2, weight: 10, score: 80 },
      { name: 'Kuis 1', category: 'kuis', cpl_id: c1, weight: 5, score: 80 },
      { name: 'Kuis 2', category: 'kuis', cpl_id: c2, weight: 5, score: 75 },
      { name: 'UTS (Soal Teori)', category: 'uts', cpl_id: c3, weight: 15, score: 75 },
      { name: 'UTS (Studi Kasus)', category: 'uts', cpl_id: c3, weight: 15, score: 80 },
      { name: 'UAS bagian A (Komprehensif)', category: 'uas', cpl_id: c3, weight: 15, score: 80 },
      { name: 'UAS bagian B (Proyek Akhir)', category: 'uas', cpl_id: c4, weight: 25, score: 90 }
    ];

    renderItemRows(currentItems);
  }

  // Pasang template Standar 4 Komponen (1 Tugas, 1 Kuis, 1 UTS, 1 UAS)
  function applyStandard4Preset() {
    const courseId = $('#gradeCourseId').val();
    const cpls = courseCPLMap[courseId] || [];

    const c1 = cpls[0] ? cpls[0].id : null;
    const c2 = cpls[1] ? cpls[1].id : c1;
    const c3 = cpls[2] ? cpls[2].id : c2;
    const c4 = cpls[3] ? cpls[3].id : c3;

    currentItems = [
      { name: 'Tugas', category: 'tugas', cpl_id: c1, weight: 20, score: 85 },
      { name: 'Kuis', category: 'kuis', cpl_id: c2, weight: 20, score: 80 },
      { name: 'UTS', category: 'uts', cpl_id: c3, weight: 25, score: 75 },
      { name: 'UAS', category: 'uas', cpl_id: c4, weight: 35, score: 85 }
    ];

    renderItemRows(currentItems);
  }

  // Tambah baris baru
  function addNewItemRow() {
    const courseId = $('#gradeCourseId').val();
    const cpls = courseCPLMap[courseId] || [];
    const firstCpl = cpls[0] ? cpls[0].id : null;

    const items = getItemsFromDOM();
    items.push({
      name: `Butir ${items.length + 1}`,
      category: 'tugas',
      cpl_id: firstCpl,
      weight: 10,
      score: 80
    });
    currentItems = items;
    renderItemRows(currentItems);
  }

  // Event handler tombol template dan aksi butir
  $('#btnPresetUserExample').on('click', applyUserExamplePreset);
  $('#btnPresetMultiTask').on('click', applyMultiTaskPreset);
  $('#btnPresetStandard4').on('click', applyStandard4Preset);
  $('#btnAddItemRow').on('click', addNewItemRow);

  // Tombol Bagi Rata Bobot pada modal nilai individual
  $('#btnPresetBalance').on('click', function () {
    const items = getItemsFromDOM();
    if (items.length === 0) return;
    const count = items.length;
    const baseWeight = Math.floor((100.0 / count) * 10) / 10;
    let accumulated = 0;
    items.forEach((it, idx) => {
      if (idx === count - 1) {
        it.weight = Math.round((100.0 - accumulated) * 10) / 10;
      } else {
        it.weight = baseWeight;
        accumulated += baseWeight;
      }
    });
    renderItemRows(items);
  });

  // Muat butir penilaian dinamis mata kuliah untuk modal input nilai individual
  function loadCourseAssessmentItemsForModal(courseId) {
    if (!courseId) return;
    loadCPLsForCourse(courseId, function () {
      $.ajax({
        url: `/api/private/courses/${courseId}/assessment-items`,
        type: 'GET',
        success: function (res) {
          const items = res.data || [];
          if (items.length > 0) {
            currentItems = items.map(it => ({
              name: it.name,
              category: it.category,
              cpl_id: it.course_cpl_id || it.cpl_id,
              weight: it.weight,
              score: 80
            }));
            renderItemRows(currentItems);
          } else {
            applyUserExamplePreset();
          }
        },
        error: function () {
          applyUserExamplePreset();
        }
      });
    });
  }

  // Hapus baris butir
  $(document).on('click', '.btn-delete-item', function () {
    const row = $(this).closest('tr');
    if ($('#itemsTableBody tr.item-row').length <= 1) {
      alert('Minimal harus ada 1 butir penilaian');
      return;
    }
    row.remove();
    updateModalScorePreview();
  });

  // Event saat mata kuliah diganti di form input
  $('#gradeCourseId').on('change', function () {
    const courseId = $(this).val();
    if (courseId) {
      loadCourseAssessmentItemsForModal(courseId);
    }
  });

  // Trigger preview saat input nilai, bobot, atau CPL pada tabel berubah
  $(document).on('input change', '#itemsTableBody input, #itemsTableBody select', function () {
    updateModalScorePreview();
  });

  // ========================================================
  // KALKULATOR LIVE PREVIEW: AKADEMIK & EVALUASI CPL (OBE)
  // ========================================================
  function updateModalScorePreview() {
    const courseId = $('#gradeCourseId').val();
    const cpls = courseCPLMap[courseId] || [];
    const items = getItemsFromDOM();

    let totalComponentWeight = 0;
    let finalScore = 0;

    // A. Hitung Nilai Akhir Mahasiswa (Performa Akademik):
    // Nilai Akhir = Σ (Nilai Komponen × Bobot Komponen / 100)
    items.forEach(it => {
      totalComponentWeight += it.weight;
      finalScore += (it.score * (it.weight / 100));
    });

    // Validasi Total Bobot Komponen (harus 100%)
    const weightInd = $('#totalWeightIndicator');
    const isWeightValid = Math.abs(totalComponentWeight - 100) < 0.1;
    if (isWeightValid) {
      weightInd.html(`Total Bobot Komponen: ${totalComponentWeight.toFixed(0)}% ✅ (Sesuai Aturan)`).css('color', '#16a34a');
    } else {
      weightInd.html(`Total Bobot Komponen: ${totalComponentWeight.toFixed(1)}% ⚠️ (Wajib 100%)`).css('color', '#dc2626');
    }

    const roundedFinal = Math.round(finalScore * 100) / 100;
    $('#previewScore').text(roundedFinal.toFixed(2));

    let letter = 'E';
    let predicate = 'Sangat Kurang';
    if (roundedFinal >= 85) { letter = 'A'; predicate = 'Sangat Baik'; }
    else if (roundedFinal >= 80) { letter = 'AB'; predicate = 'Baik Sekali'; }
    else if (roundedFinal >= 75) { letter = 'B'; predicate = 'Baik'; }
    else if (roundedFinal >= 70) { letter = 'BC'; predicate = 'Cukup Baik'; }
    else if (roundedFinal >= 65) { letter = 'C'; predicate = 'Cukup'; }
    else if (roundedFinal >= 50) { letter = 'D'; predicate = 'Kurang'; }

    $('#previewLetter').text(`${letter} (${predicate})`);

    // B. Hitung Pengukuran Ketercapaian CPL (Tingkat Kompetensi Lulusan):
    // Sesuai pedoman OBE yang dijelaskan:
    // - Nilai CPL = Rata-rata dari instrumen/subnilai yang mengukurnya (misal: UTS 75 + UAS-A 80 -> CPL-04 = (75+80)/2 = 77.5)
    // - Bobot CPL = Total bobot komponen yang mengukur CPL tersebut (misal: 25% + 20% = 45%)
    // - Target minimal kelulusan CPL: 70.0
    const cplAccumulators = {};

    // Inisialisasi setiap CPL mata kuliah
    cpls.forEach(c => {
      cplAccumulators[c.id] = {
        id: c.id,
        code: c.code,
        desc: c.description,
        target: c.target_score || 70.0,
        scoreSum: 0,
        count: 0,
        totalWeight: 0,
        components: []
      };
    });

    // Akumulasikan butir penilaian ke CPL masing-masing
    items.forEach(it => {
      if (!it.cpl_id) return;
      if (!cplAccumulators[it.cpl_id]) {
        // Fallback jika ada CPL tidak terdaftar
        cplAccumulators[it.cpl_id] = {
          id: it.cpl_id,
          code: `CPL-${it.cpl_id}`,
          desc: 'Capaian Pembelajaran',
          target: 70.0,
          scoreSum: 0,
          count: 0,
          totalWeight: 0,
          components: []
        };
      }
      const acc = cplAccumulators[it.cpl_id];
      acc.scoreSum += it.score;
      acc.count++;
      acc.totalWeight += it.weight;
      acc.components.push(`${it.name} (${it.weight}%)`);
    });

    const cplTableBody = $('#previewCplTableBody');
    cplTableBody.empty();

    const measuredCPLKeys = Object.keys(cplAccumulators).filter(k => cplAccumulators[k].count > 0);
    if (measuredCPLKeys.length === 0) {
      cplTableBody.html('<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 10px;">Belum ada CPL yang terpetakan</td></tr>');
      $('#previewCplRate').text('0.0%');
      $('#previewCplCount').text('0 / 0 CPL');
      $('#totalCplWeightBadge').html('Total Bobot CPL: 0% ⚠️').css('color', '#dc2626');
      return;
    }

    let achievedCount = 0;
    let sumCplWeights = 0;

    measuredCPLKeys.forEach(k => {
      const acc = cplAccumulators[k];
      const cplScore = acc.count > 0 ? (acc.scoreSum / acc.count) : 0;
      const roundedCplScore = Math.round(cplScore * 100) / 100;
      const isAchieved = roundedCplScore >= acc.target;

      if (isAchieved) achievedCount++;
      sumCplWeights += acc.totalWeight;

      const badge = isAchieved
        ? `<span class="badge-cpl-success" style="font-size: 0.72rem;">✅ Tercapai</span>`
        : `<span class="badge-cpl-danger" style="font-size: 0.72rem;">❌ Belum Tercapai</span>`;

      cplTableBody.append(`
        <tr>
          <td><span class="badge-cpl">${acc.code}</span></td>
          <td>${acc.desc}</td>
          <td><span style="font-size: 0.75rem; color: #475569;">${acc.components.join(', ')}</span></td>
          <td><strong>${acc.totalWeight.toFixed(1)}%</strong></td>
          <td>
            <strong style="color: #0f172a; font-size: 0.9rem;">${roundedCplScore.toFixed(2)}</strong>
            <div style="font-size: 0.68rem; color: #64748b;">(Target: ≥${acc.target})</div>
          </td>
          <td>${badge}</td>
        </tr>
      `);
    });

    // Validasi akumulasi bobot CPL
    const totalCplBadge = $('#totalCplWeightBadge');
    if (Math.abs(sumCplWeights - 100) < 0.1) {
      totalCplBadge.html(`Total Bobot CPL: ${sumCplWeights.toFixed(0)}% ✅`).css({ 'color': '#15803d', 'background': '#dcfce7', 'border-color': '#86efac' });
    } else {
      totalCplBadge.html(`Total Bobot CPL: ${sumCplWeights.toFixed(1)}% ⚠️`).css({ 'color': '#b91c1c', 'background': '#fee2e2', 'border-color': '#fecaca' });
    }

    const rate = (achievedCount / measuredCPLKeys.length) * 100;
    $('#previewCplRate').text(`${rate.toFixed(1)}%`);
    $('#previewCplCount').text(`${achievedCount} dari ${measuredCPLKeys.length} CPL Tercapai`);
  }

  // ========================================================
  // DAFTAR PENILAIAN MAHASISWA & AKSI
  // ========================================================
  function loadGrades() {
    const search = $('#searchGrade').val().trim();
    const courseId = $('#filterCourse').val();
    const letterGrade = $('#filterLetter').val();

    let url = '/api/private/grades?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (courseId) url += `course_id=${encodeURIComponent(courseId)}&`;
    if (letterGrade) url += `letter_grade=${encodeURIComponent(letterGrade)}&`;

    $.ajax({
      url: url,
      type: 'GET',
      success: function (res) {
        const tbody = $('#gradeTableBody');
        tbody.empty();
        gradesData = res.data || [];

        if (gradesData.length === 0) {
          tbody.append('<tr><td colspan="12" class="text-center" style="text-align: center; color: var(--text-muted);">Tidak ada data penilaian</td></tr>');
          return;
        }

        gradesData.forEach((g, index) => {
          const studentName = g.student ? `${g.student.name} <div style="font-size: 0.78rem; color: #64748b;">${g.student.nim}</div>` : '-';
          const courseName = g.course ? `<strong>${g.course.code}</strong><div style="font-size: 0.78rem; color: #64748b;">${g.course.name}</div>` : '-';

          // Hitung jumlah butir per kategori jika tersedia
          const items = g.items || [];
          const tCount = items.filter(it => it.category === 'tugas').length;
          const qCount = items.filter(it => it.category === 'kuis').length;
          const mCount = items.filter(it => it.category === 'uts').length;
          const uCount = items.filter(it => it.category === 'uas').length;

          const tBadge = tCount > 1 ? `<span class="badge" style="background: #e2e8f0; font-size: 0.68rem; padding: 1px 4px; border-radius: 3px;">${tCount} butir</span>` : '';
          const qBadge = qCount > 1 ? `<span class="badge" style="background: #e2e8f0; font-size: 0.68rem; padding: 1px 4px; border-radius: 3px;">${qCount} butir</span>` : '';
          const mBadge = mCount > 1 ? `<span class="badge" style="background: #e2e8f0; font-size: 0.68rem; padding: 1px 4px; border-radius: 3px;">${mCount} butir</span>` : '';
          const uBadge = uCount > 1 ? `<span class="badge" style="background: #e2e8f0; font-size: 0.68rem; padding: 1px 4px; border-radius: 3px;">${uCount} butir</span>` : '';

          // Status Ketercapaian CPL OBE
          const totalCPL = g.cpl_total_count || (g.cpl_details ? g.cpl_details.length : 0);
          const achievedCPL = g.cpl_achieved_count || (g.cpl_details ? g.cpl_details.filter(cd => cd.status === 'Tercapai').length : 0);
          const rate = g.cpl_achievement_rate || (totalCPL > 0 ? (achievedCPL / totalCPL) * 100 : 0);

          let cplRateBadge = '';
          if (rate >= 100) {
            cplRateBadge = `<span class="badge-cpl-success" style="font-size: 0.78rem;">100% Tercapai</span>`;
          } else if (rate >= 70) {
            cplRateBadge = `<span class="badge-cpl-success" style="font-size: 0.78rem;">${rate.toFixed(1)}% (${achievedCPL}/${totalCPL})</span>`;
          } else {
            cplRateBadge = `<span class="badge-cpl-danger" style="font-size: 0.78rem;">${rate.toFixed(1)}% (${achievedCPL}/${totalCPL})</span>`;
          }

          let actionButtons = `
            <button class="btn btn-info btn-sm btn-view-cpl" data-id="${g.id}" style="padding: 3px 8px; font-size: 0.75rem;">🎯 Detail</button>
          `;

          if (currentUser && currentUser.role !== 'mahasiswa') {
            actionButtons += `
              <button class="btn btn-secondary btn-sm btn-edit-grade" data-id="${g.id}" style="padding: 3px 8px; font-size: 0.75rem;">Edit</button>
              <button class="btn btn-danger btn-sm btn-delete-grade" data-id="${g.id}" style="padding: 3px 8px; font-size: 0.75rem;">Hapus</button>
            `;
          }

          tbody.append(`
            <tr>
              <td>${index + 1}</td>
              <td>${studentName}</td>
              <td>${courseName}</td>
              <td>
                <div>${g.assignment.toFixed(2)}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${g.assignment_weight}% ${tBadge}</div>
              </td>
              <td>
                <div>${g.quiz.toFixed(2)}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${g.quiz_weight}% ${qBadge}</div>
              </td>
              <td>
                <div>${g.midterm.toFixed(2)}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${g.midterm_weight}% ${mBadge}</div>
              </td>
              <td>
                <div>${g.final_exam.toFixed(2)}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${g.final_exam_weight}% ${uBadge}</div>
              </td>
              <td><strong style="color: #0f172a; font-size: 1.05rem;">${g.final_score.toFixed(2)}</strong></td>
              <td><span class="badge-grade badge-${g.letter_grade}">${g.letter_grade}</span></td>
              <td>${g.predicate}</td>
              <td>${cplRateBadge}</td>
              <td><div style="display: flex; gap: 4px;">${actionButtons}</div></td>
            </tr>
          `);
        });

        if (currentUser && currentUser.role === 'mahasiswa') {
          $('.dosen-admin-only').hide();
        }
      },
      error: function () {
        showAlert('#gradeAlert', 'Gagal memuat data penilaian');
      }
    });
  }

  // Filter trigger
  $('#searchGrade, #filterCourse, #filterLetter').on('input change', function () {
    loadGrades();
  });

  // Buka modal input nilai baru
  $('#btnOpenAddGrade').on('click', function () {
    $('#gradeModalTitle').text('Input Penilaian Pembelajaran Berbasis CPL (OBE)');
    $('#gradeForm')[0].reset();
    $('#gradeId').val('');
    $('#gradeStudentId').prop('disabled', false);
    $('#gradeCourseId').prop('disabled', false);

    const firstCourseId = $('#gradeCourseId option:eq(1)').val();
    if (firstCourseId) {
      $('#gradeCourseId').val(firstCourseId);
      loadCourseAssessmentItemsForModal(firstCourseId);
    } else {
      currentItems = [];
      renderItemRows(currentItems);
    }

    $('#gradeModal').addClass('active');
  });

  // Tutup modal
  $('.btn-close-modal').on('click', function () {
    $('#gradeModal').removeClass('active');
  });

  // Edit Nilai
  $(document).on('click', '.btn-edit-grade', function () {
    const id = $(this).data('id');
    const grade = gradesData.find(g => g.id === id);
    if (!grade) return;

    $('#gradeModalTitle').text('Edit Penilaian Pembelajaran Berbasis CPL (OBE)');
    $('#gradeId').val(grade.id);
    $('#gradeStudentId').val(grade.student_id).prop('disabled', true);
    $('#gradeCourseId').val(grade.course_id).prop('disabled', true);

    loadCPLsForCourse(grade.course_id, function () {
      if (grade.items && grade.items.length > 0) {
        currentItems = grade.items.map(it => ({
          name: it.name,
          category: it.category,
          cpl_id: it.cpl_id,
          weight: it.weight,
          score: it.score
        }));
      } else {
        // Fallback jika instrumen lama belum dipecah
        currentItems = [
          { name: 'Tugas', category: 'tugas', cpl_id: grade.assignment_cpl_id, weight: grade.assignment_weight || 20, score: grade.assignment },
          { name: 'Kuis', category: 'kuis', cpl_id: grade.quiz_cpl_id, weight: grade.quiz_weight || 15, score: grade.quiz },
          { name: 'UTS', category: 'uts', cpl_id: grade.midterm_cpl_id, weight: grade.midterm_weight || 25, score: grade.midterm },
          { name: 'UAS', category: 'uas', cpl_id: grade.final_exam_cpl_id, weight: grade.final_exam_weight || 40, score: grade.final_exam }
        ];
      }
      renderItemRows(currentItems);
      $('#gradeModal').addClass('active');
    });
  });

  // Simpan nilai OBE
  $('#gradeForm').on('submit', function (e) {
    e.preventDefault();

    const id = $('#gradeId').val();
    const studentId = parseInt($('#gradeStudentId').val(), 10);
    const courseId = parseInt($('#gradeCourseId').val(), 10);

    if (!studentId || !courseId) {
      alert('Pilih mahasiswa dan mata kuliah terlebih dahulu');
      return;
    }

    const items = getItemsFromDOM();
    if (items.length === 0) {
      alert('Tambahkan minimal 1 butir penilaian');
      return;
    }

    let totalWeight = 0;
    items.forEach(it => { totalWeight += it.weight; });
    if (Math.abs(totalWeight - 100) > 0.1) {
      alert(`Total bobot seluruh komponen penilaian harus tepat 100%. Saat ini: ${totalWeight.toFixed(1)}%. Silakan sesuaikan bobot.`);
      return;
    }

    // Hitung rata-rata tertimbang per kategori untuk kompatibilitas data
    let aSum = 0, aW = 0, qSum = 0, qW = 0, mSum = 0, mW = 0, fSum = 0, fW = 0;
    let aCpl = null, qCpl = null, mCpl = null, fCpl = null;

    items.forEach(it => {
      switch (it.category.toLowerCase()) {
        case 'tugas':
          aSum += (it.score * it.weight);
          aW += it.weight;
          if (!aCpl) aCpl = it.cpl_id;
          break;
        case 'kuis':
          qSum += (it.score * it.weight);
          qW += it.weight;
          if (!qCpl) qCpl = it.cpl_id;
          break;
        case 'uts':
          mSum += (it.score * it.weight);
          mW += it.weight;
          if (!mCpl) mCpl = it.cpl_id;
          break;
        case 'uas':
          fSum += (it.score * it.weight);
          fW += it.weight;
          if (!fCpl) fCpl = it.cpl_id;
          break;
      }
    });

    const payload = {
      student_id: studentId,
      course_id: courseId,
      assignment: aW > 0 ? (aSum / aW) : 0,
      assignment_weight: aW,
      assignment_cpl_id: aCpl,
      quiz: qW > 0 ? (qSum / qW) : 0,
      quiz_weight: qW,
      quiz_cpl_id: qCpl,
      midterm: mW > 0 ? (mSum / mW) : 0,
      midterm_weight: mW,
      midterm_cpl_id: mCpl,
      final_exam: fW > 0 ? (fSum / fW) : 0,
      final_exam_weight: fW,
      final_exam_cpl_id: fCpl,
      items: items
    };

    const isEdit = id !== '';
    const url = isEdit ? `/api/private/grades/${id}` : '/api/private/grades';
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('Menghitung & Menyimpan CPL...');

    $.ajax({
      url: url,
      type: method,
      contentType: 'application/json',
      data: JSON.stringify(payload),
      success: function (res) {
        submitBtn.prop('disabled', false).text('Simpan Penilaian OBE');
        $('#gradeModal').removeClass('active');
        showAlert('#gradeAlert', res.message || 'Penilaian OBE berhasil dihitung dan disimpan', 'success');
        loadGrades();
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Simpan Penilaian OBE');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menyimpan nilai';
        alert(errMsg);
      }
    });
  });

  // Hapus Penilaian
  $(document).on('click', '.btn-delete-grade', function () {
    const id = $(this).data('id');
    if (confirm('Apakah Anda yakin ingin menghapus data penilaian ini?')) {
      $.ajax({
        url: `/api/private/grades/${id}`,
        type: 'DELETE',
        success: function (res) {
          showAlert('#gradeAlert', res.message || 'Penilaian berhasil dihapus', 'success');
          loadGrades();
        },
        error: function (xhr) {
          const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menghapus penilaian';
          showAlert('#gradeAlert', errMsg);
        }
      });
    }
  });

  // ========================================================
  // MODAL DETAIL KETERCAPAIAN CPL MAHASISWA
  // ========================================================
  $('.btn-close-cpl-detail').on('click', function () {
    $('#cplDetailModal').removeClass('active');
  });

  $(document).on('click', '.btn-view-cpl', function () {
    const gradeId = $(this).data('id');
    const grade = gradesData.find(g => g.id === gradeId);
    if (!grade) return;

    const studentName = grade.student ? `${grade.student.name} (${grade.student.nim})` : '-';
    const courseName = grade.course ? `${grade.course.code} - ${grade.course.name}` : '-';

    $('#detailStudentName').text(studentName);
    $('#detailCourseName').text(courseName);
    $('#detailFinalScore').text(`${grade.final_score.toFixed(2)} (${grade.letter_grade})`);

    const totalCpl = grade.cpl_total_count || (grade.cpl_details ? grade.cpl_details.length : 0);
    const achievedCpl = grade.cpl_achieved_count || (grade.cpl_details ? grade.cpl_details.filter(cd => cd.status === 'Tercapai').length : 0);
    const rate = grade.cpl_achievement_rate || (totalCpl > 0 ? (achievedCpl / totalCpl) * 100 : 0);

    $('#detailCplRate').text(`${rate.toFixed(1)}%`);
    $('#detailCplFraction').text(`${achievedCpl} dari ${totalCpl} CPL Tercapai (Target ≥ 70)`);

    const unachieved = (grade.cpl_details || []).filter(cd => cd.status !== 'Tercapai').map(cd => cd.cpl_code);
    if (unachieved.length > 0) {
      $('#detailCqiBox').css({ 'background': '#fef2f2', 'border-color': '#fecaca' });
      $('#detailCqiStatus').html(`⚠️ Belum mencapai: <strong>${unachieved.join(', ')}</strong> (Perlu Remedial)`).css('color', '#b91c1c');
    } else {
      $('#detailCqiBox').css({ 'background': '#f0fdf4', 'border-color': '#bbf7d0' });
      $('#detailCqiStatus').html(`✅ Seluruh Capaian Pembelajaran Lulusan Terpenuhi`).css('color', '#15803d');
    }

    // 1. Render Tabel Capaian CPL
    const tbody = $('#cplDetailTableBody');
    tbody.empty();

    const details = grade.cpl_details || [];
    if (details.length === 0) {
      tbody.html('<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 14px;">Belum ada rincian CPL</td></tr>');
    } else {
      details.forEach(d => {
        const isAchieved = d.status === 'Tercapai';
        const badge = isAchieved
          ? `<span class="badge-cpl-success">✅ Tercapai</span>`
          : `<span class="badge-cpl-danger">❌ Belum Tercapai</span>`;

        tbody.append(`
          <tr>
            <td><span class="badge-cpl">${d.cpl_code}</span></td>
            <td><strong>${d.cpl_desc}</strong></td>
            <td><span style="font-size: 0.8rem; color: #475569;">${d.components}</span></td>
            <td><strong>${d.weight.toFixed(1)}%</strong></td>
            <td>
              <strong style="color: #0f172a; font-size: 0.95rem;">${d.score.toFixed(2)}</strong>
              <div style="font-size: 0.72rem; color: #64748b;">Target: ≥${d.target_score.toFixed(1)}</div>
            </td>
            <td>${badge}</td>
          </tr>
        `);
      });
    }

    // 2. Render Tabel Butir Penilaian Terperinci
    const itemsTbody = $('#detailItemsTableBody');
    itemsTbody.empty();
    const items = grade.items || [];
    if (items.length > 0) {
      $('#detailItemsSection').show();
      items.forEach((it, idx) => {
        const cplInfo = (grade.cpl_details || []).find(cd => cd.cpl_id === it.cpl_id);
        const cplCode = cplInfo ? cplInfo.cpl_code : `CPL-${it.cpl_id}`;
        itemsTbody.append(`
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${it.name}</strong></td>
            <td><span class="badge" style="background: #e2e8f0; text-transform: uppercase; font-size: 0.72rem; padding: 2px 6px;">${it.category}</span></td>
            <td><span class="badge-cpl">${cplCode}</span></td>
            <td><strong>${it.weight.toFixed(1)}%</strong></td>
            <td><strong style="color: #2563eb;">${it.score.toFixed(2)}</strong></td>
          </tr>
        `);
      });
    } else {
      $('#detailItemsSection').hide();
    }

    $('#cplDetailModal').addClass('active');
  });

  // ========================================================
  // MODAL REKAPITULASI CPL KELAS & CQI (LEVEL AGREGAT KELAS)
  // ========================================================
  $('#btnOpenClassRecap').on('click', function () {
    const currentCourseFilter = $('#filterCourse').val() || $('#selectRecapCourse').val();
    if (currentCourseFilter) {
      $('#selectRecapCourse').val(currentCourseFilter);
    }
    loadClassRecap($('#selectRecapCourse').val());
    $('#classRecapModal').addClass('active');
  });

  $('.btn-close-class-recap').on('click', function () {
    $('#classRecapModal').removeClass('active');
  });

  $('#selectRecapCourse').on('change', function () {
    loadClassRecap($(this).val());
  });

  function loadClassRecap(courseId) {
    if (!courseId) return;

    const matrixHead = $('#classMatrixHeader');
    const matrixBody = $('#classMatrixBody');
    const matrixFoot = $('#classMatrixFoot');
    const recapTbody = $('#classRecapTableBody');

    matrixBody.html('<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 12px;">Memuat matriks kelas...</td></tr>');
    recapTbody.html('<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 12px;">Memuat rekapitulasi CPL...</td></tr>');

    $.ajax({
      url: `/api/private/courses/${courseId}/cpl-recap`,
      type: 'GET',
      success: function (res) {
        const cplCols = res.cpl_columns || [];
        const students = res.student_matrix || [];
        const recapList = res.cpl_recap || [];
        const cqiList = res.evaluation_cqi || [];

        // 1. Render Matriks Kelas (Mahasiswa vs CPL)
        matrixHead.empty();
        matrixHead.append('<th style="width: 35px;">No</th><th>Mahasiswa</th><th style="width: 85px;">NIM</th>');
        cplCols.forEach(c => {
          matrixHead.append(`<th style="text-align: center;"><span class="badge-cpl">${c.code}</span></th>`);
        });
        matrixHead.append('<th style="width: 85px;">Nilai Akhir</th><th style="width: 55px;">Mutu</th><th style="width: 75px;">% CPL</th>');

        matrixBody.empty();
        if (students.length === 0) {
          matrixBody.html(`<tr><td colspan="${cplCols.length + 6}" style="text-align: center; color: #64748b; padding: 14px;">Belum ada mahasiswa yang dinilai pada mata kuliah ini.</td></tr>`);
          matrixFoot.empty();
        } else {
          students.forEach((s, idx) => {
            let cplCells = '';
            cplCols.forEach(c => {
              const score = s.cpl_scores ? s.cpl_scores[c.code] : undefined;
              const status = s.cpl_statuses ? s.cpl_statuses[c.code] : '';
              if (score !== undefined) {
                const isPass = score >= (c.target_score || 70.0);
                const color = isPass ? '#15803d' : '#b91c1c';
                const bg = isPass ? '#f0fdf4' : '#fef2f2';
                cplCells += `<td style="text-align: center; background: ${bg}; font-weight: 700; color: ${color};">${score.toFixed(1)}</td>`;
              } else {
                cplCells += `<td style="text-align: center; color: #94a3b8;">-</td>`;
              }
            });

            matrixBody.append(`
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${s.name}</strong></td>
                <td><span style="color: #64748b; font-size: 0.78rem;">${s.nim}</span></td>
                ${cplCells}
                <td><strong style="color: #2563eb;">${s.final_score.toFixed(2)}</strong></td>
                <td><span class="badge-grade badge-${s.letter_grade}" style="font-size: 0.72rem; padding: 2px 6px;">${s.letter_grade}</span></td>
                <td><span style="font-weight: 700; color: #0f172a;">${s.cpl_achievement_rate.toFixed(0)}%</span></td>
              </tr>
            `);
          });

          // Footer Matriks: Rata-rata dan % Kelulusan Kelas per CPL
          let avgCells = '';
          let passCells = '';

          cplCols.forEach(c => {
            const recapItem = recapList.find(r => r.cpl_id === c.id);
            if (recapItem && recapItem.total_assessed > 0) {
              avgCells += `<td style="text-align: center; color: #0f172a; font-weight: 800;">${recapItem.average_score.toFixed(1)}</td>`;
              passCells += `<td style="text-align: center; color: ${recapItem.pass_rate >= 75 ? '#15803d' : '#b91c1c'}; font-weight: 800;">${recapItem.pass_rate.toFixed(0)}%</td>`;
            } else {
              avgCells += `<td style="text-align: center;">-</td>`;
              passCells += `<td style="text-align: center;">-</td>`;
            }
          });

          matrixFoot.empty();
          matrixFoot.append(`
            <tr style="background: #f1f5f9; border-top: 2px solid #cbd5e1;">
              <td colspan="3" style="text-align: right; color: #334155;"><strong>Rata-rata Nilai CPL Kelas:</strong></td>
              ${avgCells}
              <td colspan="3" style="font-size: 0.75rem; color: #64748b;">Standar Target: ≥ 70.0</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td colspan="3" style="text-align: right; color: #334155;"><strong>Tingkat Kelulusan CPL Kelas (%):</strong></td>
              ${passCells}
              <td colspan="3" style="font-size: 0.75rem; color: #64748b;">Standar Mutu: ≥ 75%</td>
            </tr>
          `);
        }

        // 2. Render Tabel Rekapitulasi Program Studi
        recapTbody.empty();
        if (recapList.length === 0) {
          recapTbody.html('<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 16px;">Belum ada data CPL</td></tr>');
        } else {
          recapList.forEach(r => {
            let statusBadge = `<span class="badge-cpl-success">${r.status}</span>`;
            if (r.pass_rate < 75.0 && r.total_assessed > 0) {
              statusBadge = `<span class="badge-cpl-danger">${r.status}</span>`;
            }
            recapTbody.append(`
              <tr>
                <td><span class="badge-cpl">${r.cpl_code}</span></td>
                <td><strong>${r.cpl_desc}</strong></td>
                <td>≥ ${r.target_score.toFixed(1)}</td>
                <td><strong style="color: #0f172a; font-size: 0.95rem;">${r.average_score.toFixed(2)}</strong></td>
                <td>${r.achieved_count} / ${r.total_assessed} mhs</td>
                <td><strong style="color: ${r.pass_rate >= 75 ? '#15803d' : '#b91c1c'}; font-size: 0.95rem;">${r.pass_rate.toFixed(1)}%</strong></td>
                <td>${statusBadge}</td>
              </tr>
            `);
          });
        }

        // 3. Tampilkan CQI Card
        const cqiBox = $('#cqiList');
        cqiBox.empty();
        if (cqiList.length === 0) {
          cqiBox.html('✅ <strong>Semua CPL Memenuhi Standar Mutu Kelas:</strong> Tingkat kelulusan seluruh CPL kelas berada di atas 75%. Pembelajaran berjalan sangat efektif.');
        } else {
          let html = '<div style="color: #b91c1c; font-weight: 600; margin-bottom: 6px;">⚠️ Ditemukan CPL yang Memerlukan Tindakan Perbaikan (Pass Rate &lt; 75%):</div><ul style="margin: 0; padding-left: 18px;">';
          cqiList.forEach(item => {
            html += `<li>${item}</li>`;
          });
          html += '</ul><div style="margin-top: 8px; font-size: 0.8rem; color: #64748b;">Rekomendasi Tindak Lanjut: Berikan materi pengayaan/remedial dan evaluasi instrumen soal pada CPL tersebut pada siklus berikutnya.</div>';
          cqiBox.html(html);
        }
      },
      error: function () {
        matrixBody.html('<tr><td colspan="10" style="text-align: center; color: #ef4444;">Gagal memuat matriks kelas</td></tr>');
        recapTbody.html('<tr><td colspan="7" style="text-align: center; color: #ef4444;">Gagal memuat rekapitulasi CPL</td></tr>');
      }
    });
  }

  // ========================================================
  // SIMULASI 5 MAHASISWA OBE
  // ========================================================
  $('#btnOpenSimulationModal').on('click', function () {
    const currentCourseFilter = $('#filterCourse').val();
    if (currentCourseFilter) {
      $('#selectSimCourse').val(currentCourseFilter);
    }
    $('#simulationModal').addClass('active');
  });

  $('.btn-close-sim-modal').on('click', function () {
    $('#simulationModal').removeClass('active');
  });

  $('#btnExecuteSimulation').on('click', function () {
    const courseId = $('#selectSimCourse').val();
    if (!courseId) {
      alert('Pilih mata kuliah terlebih dahulu');
      return;
    }

    const btn = $(this);
    btn.prop('disabled', true).text('Menjalankan Simulasi 5 Kasus...');

    $.ajax({
      url: `/api/private/courses/${courseId}/simulate-obe`,
      type: 'POST',
      contentType: 'application/json',
      success: function (res) {
        btn.prop('disabled', false).text('Jalankan Simulasi Sekarang');
        $('#simulationModal').removeClass('active');
        showAlert('#gradeAlert', res.message || 'Simulasi 5 mahasiswa OBE berhasil dijalankan!', 'success');
        $('#filterCourse').val(courseId);
        loadGrades();

        // Otomatis buka modal rekapitulasi kelas agar pengguna langsung melihat tabel matriks OBE
        setTimeout(function () {
          $('#selectRecapCourse').val(courseId);
          loadClassRecap(courseId);
          $('#classRecapModal').addClass('active');
        }, 500);
      },
      error: function (xhr) {
        btn.prop('disabled', false).text('Jalankan Simulasi Sekarang');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menjalankan simulasi';
        alert(errMsg);
      }
    });
  });

  // ========================================================
  // PENGINPUTAN NILAI SERENTAK (MATRIKS OBE SPREADSHEET)
  // ========================================================

  function populateBatchCourseDropdown() {
    const select = $('#batchCourseSelect');
    select.empty();

    if (!coursesList || coursesList.length === 0) {
      select.append('<option value="">Belum ada mata kuliah</option>');
      return;
    }

    coursesList.forEach(c => {
      select.append(`<option value="${c.id}">${c.code} - ${c.name} (${c.credits} SKS)</option>`);
    });

    const firstId = coursesList[0].id;
    batchCourseId = firstId;
    loadBatchMatrix(firstId);
  }

  function loadBatchCourses() {
    if (coursesList && coursesList.length > 0) {
      populateBatchCourseDropdown();
      return;
    }

    $.ajax({
      url: '/api/private/courses',
      type: 'GET',
      success: function (res) {
        coursesList = res.data || [];
        populateBatchCourseDropdown();
      }
    });
  }

  // Ganti mata kuliah pada lembar input serentak
  $('#batchCourseSelect').on('change', function () {
    const cid = parseInt($(this).val(), 10);
    if (cid) {
      batchCourseId = cid;
      loadBatchMatrix(cid);
    }
  });

  function loadBatchMatrix(courseId) {
    if (!courseId) return;
    batchCourseId = courseId;

    const tbody = $('#batchMatrixBody');
    tbody.html('<tr><td colspan="15" style="text-align: center; color: #64748b; padding: 24px;">Memuat butir penilaian, mahasiswa, dan nilai yang tersimpan...</td></tr>');

    // Ambil data butir penilaian, CPL, mahasiswa, dan nilai yang sudah ada secara paralel
    const reqItems = $.ajax({ url: `/api/private/courses/${courseId}/assessment-items`, type: 'GET' });
    const reqCPLs = $.ajax({ url: `/api/private/courses/${courseId}/cpls`, type: 'GET' });
    const reqStudents = $.ajax({ url: '/api/private/students', type: 'GET' });
    const reqGrades = $.ajax({ url: `/api/private/grades?course_id=${courseId}`, type: 'GET' });

    $.when(reqItems, reqCPLs, reqStudents, reqGrades).done(function (resItems, resCPLs, resStudents, resGrades) {
      batchAssessmentItems = (resItems[0] && resItems[0].data) || [];
      batchCourseCPLs = (resCPLs[0] && resCPLs[0].data) || [];
      batchStudentsList = (resStudents[0] && resStudents[0].data) || [];
      batchExistingGrades = (resGrades[0] && resGrades[0].data) || [];

      // Update ringkasan skema asesmen mata kuliah
      renderBatchSchemeSummary();

      // Render header matriks
      renderBatchMatrixHeader(batchAssessmentItems, batchCourseCPLs);

      // Render baris mahasiswa matriks
      renderBatchMatrixBody(batchStudentsList, batchAssessmentItems, batchCourseCPLs, batchExistingGrades);

      // Hitung live seluruh baris & footer
      recalculateAllBatchRows();
    }).fail(function () {
      tbody.html('<tr><td colspan="15" style="text-align: center; color: #dc2626; padding: 20px;">Gagal memuat data matriks penilaian serentak.</td></tr>');
    });
  }

  function renderBatchSchemeSummary() {
    const course = coursesList.find(c => c.id == batchCourseId);
    const title = course ? `🎯 Skema Asesmen: ${course.code} - ${course.name}` : '🎯 Skema Butir Penilaian:';
    $('#batchSchemeTitle').text(title);

    if (!batchAssessmentItems || batchAssessmentItems.length === 0) {
      $('#batchSchemeList').text('Belum ada butir penilaian yang dikonfigurasi.');
      $('#batchSchemeWeights').text('Total Bobot: 0%');
      return;
    }

    let totalWeight = 0;
    const parts = batchAssessmentItems.map(it => {
      totalWeight += it.weight;
      const cplId = it.course_cpl_id || it.cpl_id || (it.course_cpl ? it.course_cpl.id : null);
      let cplCode = (it.course_cpl && it.course_cpl.code) ? it.course_cpl.code : null;
      if (!cplCode && cplId) {
        const cplObj = batchCourseCPLs.find(c => c.id == cplId);
        cplCode = cplObj ? cplObj.code : `CPL-${cplId}`;
      }
      if (!cplCode) cplCode = 'CPL-?';
      return `${it.name} (${it.weight}% | ${cplCode})`;
    });

    $('#batchSchemeList').text(parts.join(' • '));
    $('#batchSchemeWeights').html(`Total Bobot: <strong>${totalWeight.toFixed(0)}%</strong> ${Math.abs(totalWeight - 100) < 0.1 ? '✅' : '⚠️'}`);
  }

  function renderBatchMatrixHeader(items, cpls) {
    const itemCount = items.length > 0 ? (items.length + 1) : 1;
    const cplCount = cpls.length > 0 ? cpls.length : 1;

    $('#thColGroupItems').attr('colspan', itemCount);
    $('#thColGroupCPL').attr('colspan', cplCount + 1);

    const subHeader = $('#batchMatrixSubHeader');
    subHeader.find('th:gt(2)').remove(); // Hapus kolom dinamis sebelumnya

    // 1. Kolom-kolom Butir Komponen Penilaian
    if (items.length === 0) {
      subHeader.append('<th style="text-align: center; background: #e0f2fe; color: #0369a1;">(Belum Ada Butir)</th>');
    } else {
      items.forEach((it, idx) => {
        const cplId = it.course_cpl_id || it.cpl_id || (it.course_cpl ? it.course_cpl.id : null);
        let cplCode = (it.course_cpl && it.course_cpl.code) ? it.course_cpl.code : null;
        if (!cplCode && cplId) {
          const cplObj = cpls.find(c => c.id == cplId);
          cplCode = cplObj ? cplObj.code : `CPL-${cplId}`;
        }
        if (!cplCode) cplCode = 'CPL-?';
        subHeader.append(`
          <th style="min-width: 95px; text-align: center; background: #f0f9ff; border-bottom: 2px solid #bae6fd; padding: 6px 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
              <div style="font-weight: 700; color: #0369a1; font-size: 0.82rem; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${it.name}">${it.name}</div>
              <button type="button" class="btn-delete-batch-col" data-idx="${idx}" data-name="${it.name}" title="Hapus butir ${it.name}" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 0.75rem; padding: 0 2px;">✕</button>
            </div>
            <div style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">${it.weight}% • ${cplCode}</div>
          </th>
        `);
      });

      // Tombol ➕ Tambah Kolom Butir
      subHeader.append(`
        <th style="width: 34px; text-align: center; background: #e0f2fe; border-bottom: 2px solid #bae6fd; padding: 4px;">
          <button type="button" id="btnMatrixQuickAddCol" class="btn btn-primary btn-sm" title="Tambah Kolom Butir Asesmen Baru" style="padding: 2px 6px; font-size: 0.75rem; font-weight: 700; border-radius: 4px;">➕</button>
        </th>
      `);
    }

    // 2. Kolom Hasil Akademik
    subHeader.append(`
      <th style="width: 80px; text-align: center; background: #fef9c3; color: #854d0e; border-bottom: 2px solid #fde047; padding: 6px 8px;">
        <div style="font-weight: 700; font-size: 0.82rem;">Nilai Akhir</div>
        <div style="font-size: 0.7rem; color: #a16207;">(0–100)</div>
      </th>
      <th style="width: 55px; text-align: center; background: #fef9c3; color: #854d0e; border-bottom: 2px solid #fde047; padding: 6px 8px;">
        <div style="font-weight: 700; font-size: 0.82rem;">Mutu</div>
        <div style="font-size: 0.7rem; color: #a16207;">Grade</div>
      </th>
    `);

    // 3. Kolom Penguasaan CPL (OBE)
    if (cpls.length === 0) {
      subHeader.append('<th style="text-align: center; background: #dcfce7; color: #166534;">(Belum Ada CPL)</th>');
    } else {
      cpls.forEach(c => {
        subHeader.append(`
          <th style="min-width: 80px; text-align: center; background: #f0fdf4; border-bottom: 2px solid #bbf7d0; padding: 6px 8px;">
            <div style="font-weight: 700; color: #166534; font-size: 0.82rem;">${c.code}</div>
            <div style="font-size: 0.68rem; color: #15803d;">(≥${c.target_score})</div>
          </th>
        `);
      });
    }

    // 4. Kolom % CPL Tercapai
    subHeader.append(`
      <th style="width: 90px; text-align: center; background: #dcfce7; color: #166534; border-bottom: 2px solid #bbf7d0; padding: 6px 8px;">
        <div style="font-weight: 700; font-size: 0.82rem;">% CPL</div>
        <div style="font-size: 0.68rem; color: #15803d;">Tercapai</div>
      </th>
    `);
  }

  function renderBatchMatrixBody(students, items, cpls, existingGrades) {
    const tbody = $('#batchMatrixBody');
    tbody.empty();

    if (!students || students.length === 0) {
      tbody.html('<tr><td colspan="15" style="text-align: center; color: #94a3b8; padding: 24px;">Belum ada mahasiswa terdaftar di sistem. Silakan tambahkan data mahasiswa terlebih dahulu.</td></tr>');
      return;
    }

    if (!items || items.length === 0) {
      tbody.html('<tr><td colspan="15" style="text-align: center; color: #b91c1c; padding: 24px;">Mata kuliah ini belum memiliki butir penilaian. Silakan atur butir penilaian di Dashboard terlebih dahulu.</td></tr>');
      return;
    }

    students.forEach((s, sIdx) => {
      const existingGrade = existingGrades.find(g => g.student_id === s.id);
      let rowHtml = `
        <tr class="batch-student-row" data-student-id="${s.id}">
          <td style="text-align: center; font-weight: 700; color: #64748b;">${sIdx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${s.name}</div>
          </td>
          <td style="font-family: monospace; font-size: 0.82rem; color: #475569;">${s.nim}</td>
      `;

      // Kolom input skor untuk setiap butir penilaian
      items.forEach((it, iIdx) => {
        const itemCplId = it.course_cpl_id || it.cpl_id || (it.course_cpl ? it.course_cpl.id : 0);
        let initialScore = '';
        if (existingGrade) {
          if (existingGrade.items && existingGrade.items.length > 0) {
            // Cari item yang sesuai dengan nama atau kategori & CPL
            const matchItem = existingGrade.items.find(gi => gi.name === it.name || (gi.category === it.category && ((gi.course_cpl_id || gi.cpl_id) == itemCplId)));
            if (matchItem !== undefined) {
              initialScore = matchItem.score;
            } else if (existingGrade.items[iIdx] !== undefined) {
              initialScore = existingGrade.items[iIdx].score;
            }
          } else {
            // Fallback ke kolom standar
            switch (it.category.toLowerCase()) {
              case 'tugas': initialScore = existingGrade.assignment; break;
              case 'kuis': initialScore = existingGrade.quiz; break;
              case 'uts': initialScore = existingGrade.midterm; break;
              case 'uas': initialScore = existingGrade.final_exam; break;
            }
          }
        }

        rowHtml += `
          <td style="text-align: center; padding: 4px;">
            <input type="number" step="0.1" min="0" max="100" class="matrix-score-input"
              data-student-id="${s.id}"
              data-item-idx="${iIdx}"
              data-item-name="${it.name}"
              data-item-category="${it.category}"
              data-item-weight="${it.weight}"
              data-cpl-id="${itemCplId}"
              value="${initialScore !== '' ? initialScore : ''}"
              placeholder="0">
          </td>
        `;
      });

      // Placeholder sel kolom ➕ (tambah butir)
      if (items.length > 0) {
        rowHtml += `<td style="background: #f8fafc; text-align: center; color: #cbd5e1; font-size: 0.75rem;">•</td>`;
      }

      // Kolom Hasil Akademik: Nilai Akhir & Mutu
      rowHtml += `
        <td style="text-align: center; background: #fffbeb;">
          <strong class="batch-cell-final-score" data-student-id="${s.id}" style="font-size: 0.95rem; color: #1d4ed8;">0.00</strong>
        </td>
        <td style="text-align: center; background: #fffbeb;">
          <span class="batch-cell-letter-grade badge-grade badge-E" data-student-id="${s.id}">E</span>
        </td>
      `;

      // Kolom Penguasaan CPL (OBE)
      cpls.forEach(c => {
        rowHtml += `
          <td style="text-align: center;">
            <span class="batch-cell-cpl" data-student-id="${s.id}" data-cpl-id="${c.id}" data-target="${c.target_score}">0.0</span>
          </td>
        `;
      });

      // Kolom % CPL Tercapai
      rowHtml += `
        <td style="text-align: center;">
          <span class="batch-cell-cpl-rate badge-cpl-danger" data-student-id="${s.id}">0.0%</span>
        </td>
      </tr>
      `;

      tbody.append(rowHtml);
    });
  }

  // Live Recalculation untuk 1 baris mahasiswa
  function recalculateBatchRow(studentId) {
    const inputs = $(`.matrix-score-input[data-student-id="${studentId}"]`);
    if (inputs.length === 0) return;

    let finalScore = 0;
    let totalWeight = 0;

    // Akumulator CPL: { [cplId]: { sum: 0, count: 0, target: 70 } }
    const cplStats = {};
    batchCourseCPLs.forEach(c => {
      cplStats[c.id] = { sum: 0, count: 0, target: c.target_score || 70.0 };
    });

    inputs.each(function () {
      const valStr = $(this).val();
      const score = parseFloat(valStr) || 0;
      const weight = parseFloat($(this).data('item-weight')) || 0;
      const cplId = parseInt($(this).data('cpl-id'), 10) || 0;

      // 1. Akumulasi Nilai Akhir Akademik = Σ (Nilai Komponen × Bobot Komponen)
      finalScore += (score * (weight / 100.0));
      totalWeight += weight;

      // 2. Akumulasi Skor CPL (OBE)
      if (cplId && cplStats[cplId]) {
        cplStats[cplId].sum += score;
        cplStats[cplId].count += 1;
      }
    });

    finalScore = Math.round(finalScore * 100) / 100;

    // Tentukan Grade Huruf & Predikat
    let letterGrade = 'E';
    if (finalScore >= 85.0) letterGrade = 'A';
    else if (finalScore >= 80.0) letterGrade = 'AB';
    else if (finalScore >= 75.0) letterGrade = 'B';
    else if (finalScore >= 70.0) letterGrade = 'BC';
    else if (finalScore >= 65.0) letterGrade = 'C';
    else if (finalScore >= 50.0) letterGrade = 'D';
    else letterGrade = 'E';

    // Update cell Nilai Akhir & Mutu
    $(`.batch-cell-final-score[data-student-id="${studentId}"]`).text(finalScore.toFixed(2));
    const gradeBadge = $(`.batch-cell-letter-grade[data-student-id="${studentId}"]`);
    gradeBadge.attr('class', `batch-cell-letter-grade badge-grade badge-${letterGrade}`).text(letterGrade);

    // Update cell tiap CPL (Rata-rata instrumen pengukur CPL tersebut: Σ Score / N)
    let achievedCPLCount = 0;
    let measuredCPLCount = 0;

    batchCourseCPLs.forEach(c => {
      const stat = cplStats[c.id];
      const cell = $(`.batch-cell-cpl[data-student-id="${studentId}"][data-cpl-id="${c.id}"]`);

      if (!stat || stat.count === 0) {
        cell.text('-').attr('class', 'batch-cell-cpl');
        return;
      }

      measuredCPLCount++;
      const cplScore = Math.round((stat.sum / stat.count) * 100) / 100;
      const isAchieved = cplScore >= stat.target;

      if (isAchieved) {
        achievedCPLCount++;
        cell.text(cplScore.toFixed(1))
          .attr('class', 'batch-cell-cpl matrix-cpl-pass')
          .attr('title', `Tercapai (≥${stat.target})`);
      } else {
        cell.text(cplScore.toFixed(1))
          .attr('class', 'batch-cell-cpl matrix-cpl-fail')
          .attr('title', `Belum Tercapai (<${stat.target})`);
      }
    });

    // Update cell % CPL Tercapai: (Jumlah CPL Tercapai / Total CPL) × 100%
    const rateBadge = $(`.batch-cell-cpl-rate[data-student-id="${studentId}"]`);
    const rate = measuredCPLCount > 0 ? ((achievedCPLCount / measuredCPLCount) * 100) : 0;

    if (rate >= 100) {
      rateBadge.attr('class', 'batch-cell-cpl-rate badge-cpl-success').text('100% (4/4)');
    } else if (rate >= 70) {
      rateBadge.attr('class', 'batch-cell-cpl-rate badge-cpl-success').text(`${rate.toFixed(0)}% (${achievedCPLCount}/${measuredCPLCount})`);
    } else {
      rateBadge.attr('class', 'batch-cell-cpl-rate badge-cpl-danger').text(`${rate.toFixed(0)}% (${achievedCPLCount}/${measuredCPLCount})`);
    }
  }

  // Hitung ulang seluruh baris dan perbarui footer tabel
  function recalculateAllBatchRows() {
    batchStudentsList.forEach(s => {
      recalculateBatchRow(s.id);
    });
    updateBatchMatrixFooter();
  }

  // Perbarui Footer Matriks Kelas (Agregat Kelas & % Ketercapaian CPL Kelas)
  function updateBatchMatrixFooter() {
    const tfoot = $('#batchMatrixFoot');
    tfoot.empty();

    const studentCount = batchStudentsList.length;
    if (studentCount === 0 || batchAssessmentItems.length === 0) {
      return;
    }

    // 1. Rata-rata per butir asesmen
    const itemAverages = batchAssessmentItems.map((it, idx) => {
      let sum = 0;
      let count = 0;
      $(`.matrix-score-input[data-item-idx="${idx}"]`).each(function () {
        const val = parseFloat($(this).val());
        if (!isNaN(val)) {
          sum += val;
          count++;
        }
      });
      return count > 0 ? (sum / count) : 0;
    });

    // 2. Rata-rata Nilai Akhir Kelas
    let finalScoreSum = 0;
    $('.batch-cell-final-score').each(function () {
      finalScoreSum += (parseFloat($(this).text()) || 0);
    });
    const avgFinalScore = finalScoreSum / studentCount;

    // Mutu rata-rata
    let avgGrade = 'E';
    if (avgFinalScore >= 85) avgGrade = 'A';
    else if (avgFinalScore >= 80) avgGrade = 'AB';
    else if (avgFinalScore >= 75) avgGrade = 'B';
    else if (avgFinalScore >= 70) avgGrade = 'BC';
    else if (avgFinalScore >= 65) avgGrade = 'C';
    else if (avgFinalScore >= 50) avgGrade = 'D';

    // 3. Rata-rata per CPL & Persentase Kelulusan Kelas per CPL
    const cplAggregates = batchCourseCPLs.map(c => {
      let sum = 0;
      let passedCount = 0;
      let count = 0;

      $(`.batch-cell-cpl[data-cpl-id="${c.id}"]`).each(function () {
        const text = $(this).text().trim();
        if (text !== '-') {
          const val = parseFloat(text) || 0;
          sum += val;
          count++;
          if (val >= (c.target_score || 70.0)) {
            passedCount++;
          }
        }
      });

      const avgScore = count > 0 ? (sum / count) : 0;
      const passRate = count > 0 ? ((passedCount / count) * 100) : 0;
      return {
        cplId: c.id,
        code: c.code,
        avgScore: avgScore,
        passedCount: passedCount,
        total: count,
        passRate: passRate
      };
    });

    // Baris 1 Footer: Rata-rata Nilai Kelas
    let footRow1 = `
      <tr>
        <td colspan="3" style="text-align: right; background: #f1f5f9; color: #334155; font-weight: 700;">
          RATA-RATA KELAS:
        </td>
    `;
    itemAverages.forEach(avg => {
      footRow1 += `<td style="text-align: center; color: #0369a1;">${avg.toFixed(1)}</td>`;
    });
    if (batchAssessmentItems.length > 0) {
      footRow1 += `<td style="background: #f1f5f9;"></td>`;
    }
    footRow1 += `
      <td style="text-align: center; color: #1d4ed8; font-size: 0.95rem;">${avgFinalScore.toFixed(2)}</td>
      <td style="text-align: center;"><span class="badge-grade badge-${avgGrade}">${avgGrade}</span></td>
    `;
    cplAggregates.forEach(agg => {
      footRow1 += `<td style="text-align: center; font-weight: 700; color: #166534;">${agg.avgScore.toFixed(1)}</td>`;
    });
    footRow1 += `<td style="text-align: center; color: #15803d;">Agregat</td></tr>`;

    // Baris 2 Footer: Ketercapaian Mutu CPL Kelas (% Kelulusan ≥70)
    let footRow2 = `
      <tr style="background: #f8fafc; border-top: 1px solid #cbd5e1;">
        <td colspan="3" style="text-align: right; color: #166534; font-weight: 700;">
          KETERCAPAIAN CPL KELAS (≥70):
        </td>
    `;
    // Kosongkan sel butir
    batchAssessmentItems.forEach(() => {
      footRow2 += `<td style="text-align: center; color: #94a3b8;">-</td>`;
    });
    if (batchAssessmentItems.length > 0) {
      footRow2 += `<td style="background: #f8fafc;"></td>`;
    }
    footRow2 += `<td colspan="2" style="text-align: center; color: #64748b; font-size: 0.75rem;">(Standar OBE: ≥75%)</td>`;

    let totalCPLPassSum = 0;
    cplAggregates.forEach(agg => {
      totalCPLPassSum += agg.passRate;
      const isClassPass = agg.passRate >= 75.0; // Standar kelulusan CPL kelas
      const badgeStyle = isClassPass
        ? 'color: #15803d; background: #dcfce7; padding: 2px 6px; border-radius: 4px;'
        : 'color: #b91c1c; background: #fee2e2; padding: 2px 6px; border-radius: 4px;';

      footRow2 += `
        <td style="text-align: center; font-size: 0.78rem;">
          <span style="${badgeStyle}" title="${agg.passedCount} dari ${agg.total} mahasiswa tercapai">
            ${agg.passedCount}/${agg.total} (${agg.passRate.toFixed(0)}%)
          </span>
        </td>
      `;
    });

    const overallClassPassRate = cplAggregates.length > 0 ? (totalCPLPassSum / cplAggregates.length) : 0;
    footRow2 += `
      <td style="text-align: center;">
        <span class="${overallClassPassRate >= 75 ? 'badge-cpl-success' : 'badge-cpl-danger'}" style="font-size: 0.76rem;">
          ${overallClassPassRate.toFixed(0)}%
        </span>
      </td>
    </tr>
    `;

    tfoot.append(footRow1 + footRow2);
  }

  // Event handler live input pada sel nilai
  $(document).on('input', '.matrix-score-input', function () {
    let val = parseFloat($(this).val());
    if (val > 100) {
      $(this).val(100);
      val = 100;
    } else if (val < 0) {
      $(this).val(0);
      val = 0;
    }

    $(this).addClass('is-changed');
    const studentId = parseInt($(this).data('student-id'), 10);
    recalculateBatchRow(studentId);
    updateBatchMatrixFooter();
  });

  // Tombol "✨ Isi Simulasi 5 Kasus OBE"
  $('#btnBatchSimulate').on('click', function () {
    if (!batchCourseId) {
      alert('Pilih mata kuliah terlebih dahulu');
      return;
    }

    // Jika mahasiswa di sistem kurang dari 5, tawarkan untuk panggil endpoint simulate-obe
    if (batchStudentsList.length < 5) {
      if (confirm('Data mahasiswa kurang dari 5. Apakah Anda ingin menjalankan simulasi untuk otomatis membuat 5 data mahasiswa kasus OBE?')) {
        $('#btnExecuteSimulation').trigger('click');
      }
      return;
    }

    // Nilai 5 Mahasiswa persis sesuai prompt OBE user:
    // Mhs 1 (Ahmad Fauzan): Tugas=85, Kuis=80, UTS=75, UAS-A=80, UAS-B=90 -> Nilai Akhir: 81.75 (100% CPL)
    // Mhs 2 (Budi Pratama): Tugas=65, Kuis=75, UTS=80, UAS-A=80, UAS-B=85 -> Nilai Akhir: 77.25 (75% CPL)
    // Mhs 3 (Citra Lestari): Tugas=80, Kuis=90, UTS=85, UAS-A=85, UAS-B=75 -> Nilai Akhir: 82.75 (100% CPL)
    // Mhs 4 (Doni Saputra): Tugas=75, Kuis=60, UTS=65, UAS-A=65, UAS-B=80 -> Nilai Akhir: 69.25 (50% CPL)
    // Mhs 5 (Eka Rahmawati): Tugas=90, Kuis=85, UTS=90, UAS-A=90, UAS-B=95 -> Nilai Akhir: 90.25 (100% CPL)
    const simulationCases = [
      [85, 80, 75, 80, 90], // Mhs 1
      [65, 75, 80, 80, 85], // Mhs 2
      [80, 90, 85, 85, 75], // Mhs 3
      [75, 60, 65, 65, 80], // Mhs 4
      [90, 85, 90, 90, 95]  // Mhs 5
    ];

    simulationCases.forEach((scores, sIdx) => {
      if (sIdx >= batchStudentsList.length) return;
      const s = batchStudentsList[sIdx];

      scores.forEach((sc, iIdx) => {
        const input = $(`.matrix-score-input[data-student-id="${s.id}"][data-item-idx="${iIdx}"]`);
        if (input.length > 0) {
          input.val(sc).addClass('is-changed');
        }
      });
    });

    recalculateAllBatchRows();
    showAlert('#gradeAlert', '✨ 5 Kasus Mahasiswa Simulasi OBE berhasil diisikan ke lembar penilaian! Silakan tinjau dan klik "Simpan Semua Nilai Serentak".', 'success');
  });

  // Tombol "🧹 Bersihkan Form"
  $('#btnBatchReset').on('click', function () {
    if (!confirm('Apakah Anda yakin ingin mengosongkan semua angka nilai pada formulir serentak ini?')) {
      return;
    }
    $('.matrix-score-input').val('').addClass('is-changed');
    recalculateAllBatchRows();
  });

  // Tombol "💾 Simpan Semua Nilai Serentak" (Atas & Bawah)
  $('.btn-batch-save').on('click', function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!batchCourseId) {
      alert('Pilih mata kuliah terlebih dahulu');
      return false;
    }

    if (!batchAssessmentItems || batchAssessmentItems.length === 0) {
      alert('Mata kuliah ini belum memiliki butir penilaian');
      return false;
    }

    const payloadGrades = [];

    $('.batch-student-row').each(function () {
      const studentId = parseInt($(this).data('student-id'), 10);
      const items = [];
      let hasAnyScore = false;

      $(this).find('.matrix-score-input').each(function () {
        const scoreVal = $(this).val();
        if (scoreVal !== '') {
          hasAnyScore = true;
        }
        const score = parseFloat(scoreVal) || 0;
        const name = $(this).data('item-name') || 'Butir Penilaian';
        const category = $(this).data('item-category') || 'tugas';
        const weight = parseFloat($(this).data('item-weight')) || 0;
        const cplId = parseInt($(this).data('cpl-id'), 10) || 0;

        items.push({
          name: name,
          category: category,
          cpl_id: cplId,
          course_cpl_id: cplId,
          weight: weight,
          score: score
        });
      });

      if (hasAnyScore && items.length > 0) {
        payloadGrades.push({
          student_id: studentId,
          items: items
        });
      }
    });

    if (payloadGrades.length === 0) {
      alert('Belum ada nilai mahasiswa yang diisi. Masukkan nilai terlebih dahulu.');
      return false;
    }

    const btn = $('.btn-batch-save');
    btn.prop('disabled', true).text('⏳ Menyimpan Seluruh Nilai Serentak...');

    $.ajax({
      url: `/api/private/courses/${batchCourseId}/batch-grades`,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ grades: payloadGrades }),
      success: function (res) {
        btn.prop('disabled', false).text('💾 Simpan Semua Nilai Serentak');
        $('.matrix-score-input').removeClass('is-changed');
        showAlert('#gradeAlert', res.message || `Penilaian serentak berhasil disimpan untuk ${payloadGrades.length} mahasiswa!`, 'success');
        // Refresh matriks dan riwayat
        loadBatchMatrix(batchCourseId);
        loadGrades();
      },
      error: function (xhr) {
        btn.prop('disabled', false).text('💾 Simpan Semua Nilai Serentak');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menyimpan penilaian serentak';
        alert(errMsg);
      }
    });

    return false;
  });

  // ========================================================
  // PENGATURAN BUTIR PENILAIAN DINAMIS (IN-PLACE DI /grades)
  // ========================================================

  let modalAssessmentItems = [];

  function openManageItemsModal(courseId, autoAddNew) {
    if (!courseId) {
      alert('Pilih mata kuliah terlebih dahulu');
      return;
    }
    const course = coursesList.find(c => c.id == courseId);
    if (course) {
      $('#modalManageCourseName').text(`Mata Kuliah: ${course.code} - ${course.name} (${course.credits} SKS)`);
    }

    $('#modalManageAlert').hide();

    loadCPLsForCourse(courseId, function (cpls) {
      $.ajax({
        url: `/api/private/courses/${courseId}/assessment-items`,
        type: 'GET',
        success: function (res) {
          modalAssessmentItems = res.data || [];
          if (autoAddNew || modalAssessmentItems.length === 0) {
            const firstCpl = cpls[0] ? cpls[0].id : 0;
            modalAssessmentItems.push({
              id: 0,
              name: `Butir ${modalAssessmentItems.length + 1}`,
              category: 'tugas',
              cpl_id: firstCpl,
              course_cpl_id: firstCpl,
              weight: 10
            });
          }
          renderModalItemRows(modalAssessmentItems, cpls);
          $('#manageAssessmentItemsModal').addClass('active');
        },
        error: function () {
          showAlert('#gradeAlert', 'Gagal memuat butir penilaian mata kuliah', 'danger');
        }
      });
    });
  }

  function renderModalItemRows(items, cpls) {
    const tbody = $('#modalItemsTableBody');
    tbody.empty();

    if (!items || items.length === 0) {
      tbody.html('<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 16px;">Belum ada butir penilaian. Klik <strong>➕ Tambah Butir</strong> atau pilih template di atas.</td></tr>');
      updateModalTotalWeightBadge();
      return;
    }

    items.forEach((item, idx) => {
      const cplOptions = generateCPLOptions(cpls, item.course_cpl_id || item.cpl_id);
      const catVal = (item.category || 'tugas').toLowerCase();

      tbody.append(`
        <tr class="modal-item-row" data-id="${item.id || 0}">
          <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
          <td>
            <input type="text" class="form-control form-control-sm modal-item-name" value="${item.name || ''}" placeholder="Nama butir asesmen" required>
          </td>
          <td>
            <select class="form-control form-control-sm modal-item-category">
              <option value="tugas" ${catVal === 'tugas' ? 'selected' : ''}>Tugas</option>
              <option value="kuis" ${catVal === 'kuis' ? 'selected' : ''}>Kuis</option>
              <option value="uts" ${catVal === 'uts' ? 'selected' : ''}>UTS</option>
              <option value="uas" ${catVal === 'uas' ? 'selected' : ''}>UAS</option>
              <option value="praktikum" ${catVal === 'praktikum' ? 'selected' : ''}>Praktikum</option>
              <option value="proyek" ${catVal === 'proyek' ? 'selected' : ''}>Proyek</option>
              <option value="presentasi" ${catVal === 'presentasi' ? 'selected' : ''}>Presentasi</option>
              <option value="keaktifan" ${catVal === 'keaktifan' ? 'selected' : ''}>Keaktifan</option>
              <option value="lainnya" ${catVal === 'lainnya' ? 'selected' : ''}>Lainnya</option>
            </select>
          </td>
          <td>
            <select class="form-control form-control-sm modal-item-cpl" required>
              ${cplOptions}
            </select>
          </td>
          <td style="text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <input type="number" step="0.5" min="0" max="100" class="form-control form-control-sm modal-item-weight" value="${item.weight !== undefined ? item.weight : 20}" style="width: 75px; text-align: center; font-weight: 600;" required>
              <span style="font-size: 0.75rem; color: #64748b;">%</span>
            </div>
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-sm btn-modal-delete-item" title="Hapus butir ini" style="padding: 2px 7px; font-size: 0.75rem;">🗑️</button>
          </td>
        </tr>
      `);
    });

    updateModalTotalWeightBadge();
  }

  function getModalItemsFromDOM() {
    const items = [];
    $('#modalItemsTableBody tr.modal-item-row').each(function (idx) {
      const row = $(this);
      const id = parseInt(row.data('id'), 10) || 0;
      const name = row.find('.modal-item-name').val().trim() || `Butir ${idx + 1}`;
      const category = row.find('.modal-item-category').val() || 'tugas';
      const cplId = parseInt(row.find('.modal-item-cpl').val(), 10) || 0;
      const weight = parseFloat(row.find('.modal-item-weight').val()) || 0;

      items.push({
        id: id,
        name: name,
        category: category,
        cpl_id: cplId,
        course_cpl_id: cplId,
        weight: weight,
        order_index: idx + 1
      });
    });
    return items;
  }

  function updateModalTotalWeightBadge() {
    const items = getModalItemsFromDOM();
    let totalWeight = 0;
    items.forEach(it => { totalWeight += it.weight; });

    const badge = $('#modalTotalWeightBadge');
    if (Math.abs(totalWeight - 100) < 0.01) {
      badge.html(`Total Bobot: ${totalWeight.toFixed(0)}% ✅`)
        .css({ 'color': '#15803d', 'background': '#dcfce7', 'border-color': '#86efac' });
    } else {
      badge.html(`Total Bobot: ${totalWeight.toFixed(1)}% ⚠️ (Harus Tepat 100%)`)
        .css({ 'color': '#b91c1c', 'background': '#fee2e2', 'border-color': '#fecaca' });
    }
  }

  function balanceModalWeights() {
    const items = getModalItemsFromDOM();
    if (items.length === 0) return;
    const count = items.length;
    const baseWeight = Math.floor((100.0 / count) * 10) / 10;
    let accumulated = 0;
    items.forEach((it, idx) => {
      if (idx === count - 1) {
        it.weight = Math.round((100.0 - accumulated) * 10) / 10;
      } else {
        it.weight = baseWeight;
        accumulated += baseWeight;
      }
    });

    const cpls = courseCPLMap[batchCourseId] || [];
    renderModalItemRows(items, cpls);
  }

  // Tombol Buka Modal Kelola Butir Asesmen
  $('#btnOpenManageItemsModal').on('click', function () {
    openManageItemsModal(batchCourseId, false);
  });

  $(document).on('click', '#btnQuickAddBatchItem, #btnMatrixQuickAddCol', function () {
    openManageItemsModal(batchCourseId, true);
  });

  $('.btn-close-manage-items').on('click', function () {
    $('#manageAssessmentItemsModal').removeClass('active');
  });

  $('#btnModalAddItem').on('click', function () {
    const cpls = courseCPLMap[batchCourseId] || [];
    const items = getModalItemsFromDOM();
    items.push({
      id: 0,
      name: `Butir ${items.length + 1}`,
      category: 'tugas',
      cpl_id: cpls[0] ? cpls[0].id : 0,
      course_cpl_id: cpls[0] ? cpls[0].id : 0,
      weight: 10
    });
    renderModalItemRows(items, cpls);
  });

  $(document).on('click', '.btn-modal-delete-item', function () {
    const cpls = courseCPLMap[batchCourseId] || [];
    $(this).closest('tr').remove();
    const items = getModalItemsFromDOM();
    renderModalItemRows(items, cpls);
  });

  $(document).on('input change', '.modal-item-weight', updateModalTotalWeightBadge);

  $('#btnModalBalanceWeights').on('click', balanceModalWeights);

  // Template Presets di dalam Modal
  $('#btnModalPresetUser').on('click', function () {
    const cpls = courseCPLMap[batchCourseId] || [];
    let cpl02Id = null, cpl03Id = null, cpl04Id = null, cpl05Id = null;
    cpls.forEach(c => {
      if (c.code === 'CPL-02' || c.code === 'CPL-2') cpl02Id = c.id;
      if (c.code === 'CPL-03' || c.code === 'CPL-3') cpl03Id = c.id;
      if (c.code === 'CPL-04' || c.code === 'CPL-4') cpl04Id = c.id;
      if (c.code === 'CPL-05' || c.code === 'CPL-5') cpl05Id = c.id;
    });
    if (!cpl02Id && cpls.length > 0) cpl02Id = cpls[0].id;
    if (!cpl03Id && cpls.length > 1) cpl03Id = cpls[1].id;
    if (!cpl04Id && cpls.length > 2) cpl04Id = cpls[2].id;
    if (!cpl05Id && cpls.length > 3) cpl05Id = cpls[3].id;

    const items = [
      { name: 'Tugas', category: 'tugas', course_cpl_id: cpl03Id || (cpls[0] ? cpls[0].id : 0), weight: 20 },
      { name: 'Kuis', category: 'kuis', course_cpl_id: cpl02Id || (cpls[0] ? cpls[0].id : 0), weight: 15 },
      { name: 'UTS', category: 'uts', course_cpl_id: cpl04Id || (cpls[0] ? cpls[0].id : 0), weight: 25 },
      { name: 'UAS bagian A', category: 'uas', course_cpl_id: cpl04Id || (cpls[0] ? cpls[0].id : 0), weight: 20 },
      { name: 'UAS bagian B', category: 'uas', course_cpl_id: cpl05Id || (cpls[0] ? cpls[0].id : 0), weight: 20 }
    ];
    renderModalItemRows(items, cpls);
  });

  $('#btnModalPresetMulti').on('click', function () {
    const cpls = courseCPLMap[batchCourseId] || [];
    const c1 = cpls[0] ? cpls[0].id : 0;
    const c2 = cpls[1] ? cpls[1].id : c1;
    const c3 = cpls[2] ? cpls[2].id : c2;
    const c4 = cpls[3] ? cpls[3].id : c3;

    const items = [
      { name: 'Tugas 1 (Teori Dasar)', category: 'tugas', course_cpl_id: c1, weight: 10 },
      { name: 'Tugas 2 (Analisis Kasus)', category: 'tugas', course_cpl_id: c2, weight: 10 },
      { name: 'Kuis 1', category: 'kuis', course_cpl_id: c1, weight: 5 },
      { name: 'Kuis 2', category: 'kuis', course_cpl_id: c2, weight: 5 },
      { name: 'UTS (Soal Teori)', category: 'uts', course_cpl_id: c3, weight: 15 },
      { name: 'UTS (Studi Kasus)', category: 'uts', course_cpl_id: c3, weight: 15 },
      { name: 'UAS bagian A (Komprehensif)', category: 'uas', course_cpl_id: c3, weight: 15 },
      { name: 'UAS bagian B (Proyek Akhir)', category: 'uas', course_cpl_id: c4, weight: 25 }
    ];
    renderModalItemRows(items, cpls);
  });

  $('#btnModalPresetStd').on('click', function () {
    const cpls = courseCPLMap[batchCourseId] || [];
    const c1 = cpls[0] ? cpls[0].id : 0;
    const c2 = cpls[1] ? cpls[1].id : c1;
    const c3 = cpls[2] ? cpls[2].id : c2;
    const c4 = cpls[3] ? cpls[3].id : c3;

    const items = [
      { name: 'Tugas', category: 'tugas', course_cpl_id: c1, weight: 20 },
      { name: 'Kuis', category: 'kuis', course_cpl_id: c2, weight: 20 },
      { name: 'UTS', category: 'uts', course_cpl_id: c3, weight: 25 },
      { name: 'UAS', category: 'uas', course_cpl_id: c4, weight: 35 }
    ];
    renderModalItemRows(items, cpls);
  });

  // Simpan butir penilaian dari modal in-place
  $('#btnSaveModalAssessmentItems').on('click', function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!batchCourseId) {
      alert('Pilih mata kuliah terlebih dahulu');
      return false;
    }

    const items = getModalItemsFromDOM();
    if (items.length === 0) {
      alert('Minimal harus ada 1 butir penilaian');
      return false;
    }

    let totalWeight = 0;
    for (const it of items) {
      if (!it.name) {
        alert('Setiap butir penilaian harus memiliki nama');
        return false;
      }
      const itemCpl = it.course_cpl_id || it.cpl_id;
      if (!itemCpl) {
        alert(`Pilih target CPL untuk butir "${it.name}"`);
        return false;
      }
      totalWeight += it.weight;
    }

    if (Math.abs(totalWeight - 100) > 0.01) {
      alert(`Total bobot seluruh butir penilaian harus tepat 100%. Saat ini: ${totalWeight.toFixed(1)}%. Silakan klik tombol '⚖️ Bagi Rata Bobot' atau sesuaikan bobot.`);
      return false;
    }

    const btn = $(this);
    btn.prop('disabled', true).text('⏳ Menyimpan Butir Penilaian...');

    $.ajax({
      url: `/api/private/courses/${batchCourseId}/assessment-items`,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({ items: items }),
      success: function (res) {
        btn.prop('disabled', false).text('💾 Simpan & Terapkan ke Lembar Matriks');
        $('#manageAssessmentItemsModal').removeClass('active');
        showAlert('#gradeAlert', res.message || 'Butir penilaian mata kuliah berhasil diperbarui dan diterapkan ke matriks!', 'success');
        // Refresh lembar matriks serentak secara on-the-fly!
        loadBatchMatrix(batchCourseId);
      },
      error: function (xhr) {
        btn.prop('disabled', false).text('💾 Simpan & Terapkan ke Lembar Matriks');
        const err = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menyimpan butir penilaian';
        showAlert('#modalManageAlert', err, 'danger');
      }
    });

    return false;
  });

  // Hapus butir langsung dari header kolom tabel matriks
  $(document).on('click', '.btn-delete-batch-col', function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const idx = parseInt($(this).data('idx'), 10);
    const itemName = $(this).data('name') || `Butir ${idx + 1}`;

    if (batchAssessmentItems.length <= 1) {
      alert('Mata kuliah harus memiliki minimal 1 butir penilaian');
      return false;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus butir "${itemName}" dari rancangan penilaian mata kuliah ini? Bobot sisa akan diseimbangkan otomatis menjadi 100%.`)) {
      return false;
    }

    // Salin items dan hapus index yang dipilih
    const newItems = batchAssessmentItems.filter((_, i) => i !== idx).map((it, i) => ({
      name: it.name,
      category: it.category,
      cpl_id: it.course_cpl_id || it.cpl_id,
      course_cpl_id: it.course_cpl_id || it.cpl_id,
      weight: it.weight,
      order_index: i + 1
    }));

    // Auto balance bobot 100%
    const count = newItems.length;
    const baseWeight = Math.floor((100.0 / count) * 10) / 10;
    let accumulated = 0;
    newItems.forEach((it, i) => {
      if (i === count - 1) {
        it.weight = Math.round((100.0 - accumulated) * 10) / 10;
      } else {
        it.weight = baseWeight;
        accumulated += baseWeight;
      }
    });

    $.ajax({
      url: `/api/private/courses/${batchCourseId}/assessment-items`,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({ items: newItems }),
      success: function (res) {
        showAlert('#gradeAlert', `Butir "${itemName}" berhasil dihapus dan bobot telah diseimbangkan otomatis!`, 'success');
        loadBatchMatrix(batchCourseId);
      },
      error: function (xhr) {
        const err = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menghapus butir penilaian';
        alert(err);
      }
    });
  });
});

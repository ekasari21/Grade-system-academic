$(document).ready(function () {
  let dashCoursesList = [];
  let dashCourseCPLs = {}; // { [courseId]: [cpls] }
  let dashCurrentItems = [];

  // Inisialisasi autentikasi
  initAuth().done(function () {
    loadDashboardSummary();
    if (currentUser && currentUser.role !== 'mahasiswa') {
      loadDashboardCourses();
    } else {
      $('#dashAssessmentConfigCard').hide();
    }
  });

  function loadDashboardSummary() {
    $.ajax({
      url: '/api/private/dashboard/summary',
      type: 'GET',
      success: function (res) {
        if (res.role === 'mahasiswa') {
          // Tampilan kartu khusus Mahasiswa
          $('#cardStudentsLabel').text('MATA KULIAH DIAMBIL');
          $('#statStudents').text(res.total_courses || 0);

          $('#cardCoursesLabel').text('STATUS AKADEMIK');
          $('#statCourses').text('AKTIF');

          $('#cardGradesLabel').text('SEMESTER AKTIF');
          $('#statGrades').text('Ganjil 2026');

          $('#statAverage').text((res.average_score || 0).toFixed(2));
        } else {
          // Tampilan kartu untuk Dosen & Admin
          $('#statStudents').text(res.total_students || 0);
          $('#statCourses').text(res.total_courses || 0);
          $('#statGrades').text(res.total_grades || 0);
          $('#statAverage').text((res.average_score || 0).toFixed(2));
        }

        // Tampilkan statistik CPL
        const cplStats = res.cpl_stats || {};
        const totalCpl = cplStats.total || cplStats.total_evaluated || 0;
        const achievedCpl = cplStats.achieved || cplStats.total_achieved || 0;
        const cplRate = cplStats.rate || 0;

        $('#statTotalCpl').text(totalCpl);
        $('#statAchievedCpl').text(achievedCpl);
        $('#statCplPercentage').text(`${cplRate.toFixed(1)}%`);
        $('#cplRateBadge').text(`${cplRate.toFixed(1)}% Tercapai`);
        if (cplRate < 60) {
          $('#cplRateBadge').removeClass('badge-cpl-success').addClass('badge-cpl-danger');
        } else {
          $('#cplRateBadge').removeClass('badge-cpl-danger').addClass('badge-cpl-success');
        }

        // Tampilkan distribusi grade huruf
        const dist = res.distribution || {};
        $('#countGradeA').text(dist.A || 0);
        $('#countGradeAB').text(dist.AB || 0);
        $('#countGradeB').text(dist.B || 0);
        $('#countGradeBC').text(dist.BC || 0);
        $('#countGradeC').text(dist.C || 0);
        $('#countGradeD').text(dist.D || 0);
        $('#countGradeE').text(dist.E || 0);
      },
      error: function () {
        showAlert('#pageAlert', 'Gagal memuat ringkasan data dashboard');
      }
    });
  }

  // ========================================================
  // PENGATURAN BUTIR PENILAIAN MATA KULIAH (RPS ASESMEN OBE)
  // ========================================================

  function loadDashboardCourses() {
    $.ajax({
      url: '/api/private/courses',
      type: 'GET',
      success: function (res) {
        dashCoursesList = res.data || [];
        const select = $('#selectDashboardCourse');
        select.empty();

        if (dashCoursesList.length === 0) {
          select.append('<option value="">Belum ada mata kuliah terdaftar</option>');
          $('#dashItemsTableBody').html('<tr><td colspan="6" style="text-align:center; color: #94a3b8; padding: 16px;">Belum ada mata kuliah yang tersedia.</td></tr>');
          return;
        }

        dashCoursesList.forEach(c => {
          select.append(`<option value="${c.id}">${c.code} - ${c.name} (${c.credits} SKS)</option>`);
          if (c.cpls) {
            dashCourseCPLs[c.id] = c.cpls;
          }
        });

        const firstId = dashCoursesList[0].id;
        loadCourseAssessmentItems(firstId);
      },
      error: function () {
        showAlert('#dashConfigAlert', 'Gagal memuat daftar mata kuliah', 'danger');
      }
    });
  }

  function loadCourseAssessmentItems(courseId) {
    if (!courseId) return;

    const course = dashCoursesList.find(c => c.id == courseId);
    if (course) {
      $('#dashCourseBadge').text(`Mata Kuliah: ${course.code} - ${course.name}`);
    }

    // Pastikan CPL sudah ter-load
    ensureDashCourseCPLs(courseId, function (cpls) {
      $.ajax({
        url: `/api/private/courses/${courseId}/assessment-items`,
        type: 'GET',
        success: function (res) {
          dashCurrentItems = res.data || [];
          renderDashItems(dashCurrentItems, cpls);
        },
        error: function () {
          showAlert('#dashConfigAlert', 'Gagal memuat butir penilaian mata kuliah', 'danger');
        }
      });
    });
  }

  function ensureDashCourseCPLs(courseId, callback) {
    if (dashCourseCPLs[courseId] && dashCourseCPLs[courseId].length > 0) {
      if (callback) callback(dashCourseCPLs[courseId]);
      return;
    }

    $.ajax({
      url: `/api/private/courses/${courseId}/cpls`,
      type: 'GET',
      success: function (res) {
        dashCourseCPLs[courseId] = res.data || [];
        if (callback) callback(dashCourseCPLs[courseId]);
      },
      error: function () {
        if (callback) callback([]);
      }
    });
  }

  function generateDashCPLOptions(cpls, selectedId) {
    if (!cpls || cpls.length === 0) {
      return '<option value="">(Belum ada CPL terdaftar)</option>';
    }
    return cpls.map(c => {
      const isSel = (c.id === selectedId) ? 'selected' : '';
      const shortDesc = c.description.length > 32 ? c.description.substring(0, 32) + '...' : c.description;
      return `<option value="${c.id}" ${isSel}>${c.code} (${shortDesc})</option>`;
    }).join('');
  }

  function renderDashItems(items, cpls) {
    const tbody = $('#dashItemsTableBody');
    tbody.empty();

    if (!items || items.length === 0) {
      tbody.html('<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 16px;">Belum ada butir penilaian. Silakan klik tombol template preset atau <strong>➕ Tambah Butir</strong>.</td></tr>');
      updateDashTotalWeight();
      return;
    }

    items.forEach((item, idx) => {
      const cplOptions = generateDashCPLOptions(cpls, item.course_cpl_id || item.cpl_id);
      const catVal = (item.category || 'tugas').toLowerCase();

      tbody.append(`
        <tr class="dash-item-row" data-id="${item.id || 0}">
          <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
          <td>
            <input type="text" class="form-control form-control-sm dash-item-name" value="${item.name || ''}" placeholder="Nama butir asesmen" required>
          </td>
          <td>
            <select class="form-control form-control-sm dash-item-category">
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
            <select class="form-control form-control-sm dash-item-cpl" required>
              ${cplOptions}
            </select>
          </td>
          <td style="text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <input type="number" step="0.5" min="0" max="100" class="form-control form-control-sm dash-item-weight" value="${item.weight !== undefined ? item.weight : 20}" style="width: 80px; text-align: center; font-weight: 600;" required>
              <span style="font-size: 0.8rem; font-weight: 600; color: #64748b;">%</span>
            </div>
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-sm btn-dash-delete-item" title="Hapus butir ini" style="padding: 2px 7px; font-size: 0.78rem;">🗑️</button>
          </td>
        </tr>
      `);
    });

    updateDashTotalWeight();
  }

  function getDashItemsFromDOM() {
    const items = [];
    $('#dashItemsTableBody tr.dash-item-row').each(function (idx) {
      const row = $(this);
      const id = parseInt(row.data('id'), 10) || 0;
      const name = row.find('.dash-item-name').val().trim() || `Butir ${idx + 1}`;
      const category = row.find('.dash-item-category').val() || 'tugas';
      const cplId = parseInt(row.find('.dash-item-cpl').val(), 10) || 0;
      const weight = parseFloat(row.find('.dash-item-weight').val()) || 0;

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

  function updateDashTotalWeight() {
    const items = getDashItemsFromDOM();
    let totalWeight = 0;
    items.forEach(it => { totalWeight += it.weight; });

    const badge = $('#dashTotalWeightBadge');
    if (Math.abs(totalWeight - 100) < 0.01) {
      badge.html(`Total Bobot: ${totalWeight.toFixed(0)}% ✅`)
        .css({ 'color': '#15803d', 'background': '#dcfce7', 'border-color': '#86efac' });
    } else {
      badge.html(`Total Bobot: ${totalWeight.toFixed(1)}% ⚠️ (Harus Tepat 100%)`)
        .css({ 'color': '#b91c1c', 'background': '#fee2e2', 'border-color': '#fecaca' });
    }
  }

  // Event handler pergantian mata kuliah di dashboard
  $('#selectDashboardCourse').on('change', function () {
    const courseId = $(this).val();
    if (courseId) {
      loadCourseAssessmentItems(courseId);
    }
  });

  // Event handler live input bobot & tambah/hapus butir
  $(document).on('input change', '.dash-item-weight', function () {
    updateDashTotalWeight();
  });

  $('#btnDashAddItem').on('click', function () {
    const courseId = $('#selectDashboardCourse').val();
    const cpls = dashCourseCPLs[courseId] || [];
    const items = getDashItemsFromDOM();

    items.push({
      id: 0,
      name: `Tugas/Kuis ${items.length + 1}`,
      category: 'tugas',
      cpl_id: cpls[0] ? cpls[0].id : 0,
      course_cpl_id: cpls[0] ? cpls[0].id : 0,
      weight: 10,
      order_index: items.length + 1
    });

    renderDashItems(items, cpls);
  });

  $(document).on('click', '.btn-dash-delete-item', function () {
    const courseId = $('#selectDashboardCourse').val();
    const cpls = dashCourseCPLs[courseId] || [];
    $(this).closest('tr').remove();

    const items = getDashItemsFromDOM();
    renderDashItems(items, cpls);
  });

  // Tombol Bagi Rata Bobot 100% secara merata
  $('#btnDashBalanceWeights').on('click', function () {
    const courseId = $('#selectDashboardCourse').val();
    const cpls = dashCourseCPLs[courseId] || [];
    const items = getDashItemsFromDOM();
    if (items.length === 0) return;

    const count = items.length;
    const baseWeight = Math.floor((100.0 / count) * 10) / 10;
    let accumulated = 0;

    items.forEach((it, idx) => {
      if (idx === count - 1) {
        // Item terakhir menampung sisa pembulatan agar tepat 100%
        it.weight = Math.round((100.0 - accumulated) * 10) / 10;
      } else {
        it.weight = baseWeight;
        accumulated += baseWeight;
      }
    });

    renderDashItems(items, cpls);
  });

  // Template Preset: Contoh Kasus OBE (5 Butir)
  $('#btnDashPresetUser').on('click', function () {
    const courseId = $('#selectDashboardCourse').val();
    const cpls = dashCourseCPLs[courseId] || [];

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

    renderDashItems(items, cpls);
  });

  // Template Preset: Multiple Tugas & Kuis (8 Butir)
  $('#btnDashPresetMulti').on('click', function () {
    const courseId = $('#selectDashboardCourse').val();
    const cpls = dashCourseCPLs[courseId] || [];

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

    renderDashItems(items, cpls);
  });

  // Template Preset: Standar 4 Butir
  $('#btnDashPresetStd').on('click', function () {
    const courseId = $('#selectDashboardCourse').val();
    const cpls = dashCourseCPLs[courseId] || [];

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

    renderDashItems(items, cpls);
  });

  // Simpan Pengaturan Butir Penilaian Mata Kuliah ke Backend
  $('#btnSaveDashAssessmentItems').on('click', function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const courseId = $('#selectDashboardCourse').val();
    if (!courseId) {
      alert('Pilih mata kuliah terlebih dahulu');
      return false;
    }

    const items = getDashItemsFromDOM();
    if (items.length === 0) {
      alert('Tambahkan minimal 1 butir penilaian');
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
      alert(`Total bobot seluruh komponen penilaian harus tepat 100%. Saat ini: ${totalWeight.toFixed(1)}%. Silakan sesuaikan bobot.`);
      return false;
    }

    const btn = $(this);
    btn.prop('disabled', true).text('⏳ Menyimpan Butir Penilaian...');

    $.ajax({
      url: `/api/private/courses/${courseId}/assessment-items`,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({ items: items }),
      success: function (res) {
        btn.prop('disabled', false).text('💾 Simpan Pengaturan Butir MK');
        showAlert('#dashConfigAlert', res.message || 'Butir penilaian mata kuliah berhasil disimpan', 'success');
        // Refresh items dari server
        loadCourseAssessmentItems(courseId);
      },
      error: function (xhr) {
        btn.prop('disabled', false).text('💾 Simpan Pengaturan Butir MK');
        const err = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menyimpan butir penilaian';
        showAlert('#dashConfigAlert', err, 'danger');
      }
    });

    return false;
  });
});

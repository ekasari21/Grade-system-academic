$(document).ready(function () {
  initAuth().done(function () {
    loadCourses();
  });

  // Muat daftar mata kuliah
  function loadCourses() {
    $.ajax({
      url: '/api/private/courses',
      type: 'GET',
      success: function (res) {
        const tbody = $('#courseTableBody');
        tbody.empty();

        if (!res.data || res.data.length === 0) {
          tbody.append('<tr><td colspan="6" class="text-center" style="text-align: center; color: var(--text-muted);">Tidak ada data mata kuliah</td></tr>');
          return;
        }

        res.data.forEach((course, index) => {
          const cplCount = (course.cpls && course.cpls.length) || 0;
          let cplBadges = `<span class="badge badge-secondary" style="font-size: 0.78rem;">${cplCount} CPL</span>`;
          if (cplCount > 0) {
            cplBadges = course.cpls.map(c => `<span class="badge-cpl" style="margin-right: 4px;" title="${c.description}">${c.code}</span>`).join(' ');
          }

          let actionButtons = '-';
          if (currentUser && currentUser.role !== 'mahasiswa') {
            actionButtons = `
              <button class="btn btn-info btn-sm btn-manage-cpl" data-id="${course.id}" data-code="${course.code}" data-name="${course.name}" style="margin-right: 4px;">🎯 CPL (${cplCount})</button>
              <button class="btn btn-secondary btn-sm btn-edit-course" data-id="${course.id}" data-code="${course.code}" data-name="${course.name}" data-credits="${course.credits}">Edit</button>
              <button class="btn btn-danger btn-sm btn-delete-course" data-id="${course.id}" data-name="${course.name}">Hapus</button>
            `;
          } else {
            actionButtons = `<button class="btn btn-info btn-sm btn-manage-cpl" data-id="${course.id}" data-code="${course.code}" data-name="${course.name}">Lihat CPL</button>`;
          }

          tbody.append(`
            <tr>
              <td>${index + 1}</td>
              <td><strong>${course.code}</strong></td>
              <td>${course.name}</td>
              <td>${course.credits} SKS</td>
              <td>${cplBadges}</td>
              <td>${actionButtons}</td>
            </tr>
          `);
        });

        if (currentUser && currentUser.role === 'mahasiswa') {
          $('.dosen-admin-only').hide();
        }
      },
      error: function () {
        showAlert('#courseAlert', 'Gagal memuat data mata kuliah');
      }
    });
  }

  // Buka modal tambah mata kuliah
  $('#btnOpenAddCourse').on('click', function () {
    $('#courseModalTitle').text('Tambah Mata Kuliah Baru');
    $('#courseForm')[0].reset();
    $('#courseId').val('');
    $('#courseModal').addClass('active');
  });

  // Tutup modal mata kuliah
  $('.btn-close-modal').on('click', function () {
    $('#courseModal').removeClass('active');
  });

  // Klik tombol Edit mata kuliah
  $(document).on('click', '.btn-edit-course', function () {
    const id = $(this).data('id');
    const code = $(this).data('code');
    const name = $(this).data('name');
    const credits = $(this).data('credits');

    $('#courseModalTitle').text('Edit Mata Kuliah');
    $('#courseId').val(id);
    $('#inputCode').val(code);
    $('#inputCourseName').val(name);
    $('#inputCredits').val(credits);
    $('#courseModal').addClass('active');
  });

  // Simpan Mata Kuliah (Tambah / Edit)
  $('#courseForm').on('submit', function (e) {
    e.preventDefault();

    const id = $('#courseId').val();
    const code = $('#inputCode').val().trim();
    const name = $('#inputCourseName').val().trim();
    const credits = parseInt($('#inputCredits').val(), 10);

    const isEdit = id !== '';
    const url = isEdit ? `/api/private/courses/${id}` : '/api/private/courses';
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('Menyimpan...');

    $.ajax({
      url: url,
      type: method,
      contentType: 'application/json',
      data: JSON.stringify({ code, name, credits }),
      success: function (res) {
        submitBtn.prop('disabled', false).text('Simpan');
        $('#courseModal').removeClass('active');
        showAlert('#courseAlert', res.message || 'Data berhasil disimpan', 'success');
        loadCourses();
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Simpan');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menyimpan mata kuliah';
        alert(errMsg);
      }
    });
  });

  // Hapus Mata Kuliah
  $(document).on('click', '.btn-delete-course', function () {
    const id = $(this).data('id');
    const name = $(this).data('name');

    if (confirm(`Apakah Anda yakin ingin menghapus mata kuliah: ${name}?`)) {
      $.ajax({
        url: `/api/private/courses/${id}`,
        type: 'DELETE',
        success: function (res) {
          showAlert('#courseAlert', res.message || 'Mata kuliah berhasil dihapus', 'success');
          loadCourses();
        },
        error: function (xhr) {
          const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menghapus mata kuliah';
          showAlert('#courseAlert', errMsg);
        }
      });
    }
  });

  // ==========================================
  // MANAJEMEN CPL MATA KULIAH
  // ==========================================

  let currentCourseIdForCPL = null;

  // Tutup modal CPL
  $('.btn-close-cpl-modal').on('click', function () {
    $('#cplModal').removeClass('active');
  });

  // Buka modal Kelola CPL
  $(document).on('click', '.btn-manage-cpl', function () {
    const id = $(this).data('id');
    const code = $(this).data('code');
    const name = $(this).data('name');

    currentCourseIdForCPL = id;
    $('#cplCourseId').val(id);
    $('#cplModalTitle').text(`🎯 Kelola CPL — ${code}`);
    $('#cplModalSubtitle').text(`${name} (ID: ${id})`);
    $('#cplModalAlert').hide().empty();
    $('#addCplForm')[0].reset();
    $('#inputCplTarget').val('70');

    loadCourseCPLs(id);
    $('#cplModal').addClass('active');
  });

  // Muat data CPL mata kuliah
  function loadCourseCPLs(courseId) {
    const tbody = $('#cplTableBody');
    tbody.html('<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Memuat data CPL...</td></tr>');

    $.ajax({
      url: `/api/private/courses/${courseId}/cpls`,
      type: 'GET',
      success: function (res) {
        tbody.empty();
        const cpls = res.data || [];

        if (cpls.length === 0) {
          tbody.append('<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 16px;">Mata kuliah ini belum memiliki CPL. Klik tombol "Buat CPL Standar Otomatis" atau tambah CPL di bawah.</td></tr>');
          $('#btnGenerateDefaultCPL').show();
          return;
        }

        $('#btnGenerateDefaultCPL').hide();

        cpls.forEach(c => {
          let deleteBtn = '-';
          if (currentUser && currentUser.role !== 'mahasiswa') {
            deleteBtn = `<button class="btn btn-danger btn-sm btn-delete-cpl" data-id="${c.id}" data-code="${c.code}" style="padding: 2px 8px; font-size: 0.75rem;">Hapus</button>`;
          }

          tbody.append(`
            <tr>
              <td><span class="badge-cpl">${c.code}</span></td>
              <td>${c.description}</td>
              <td><span style="font-weight: 600; color: #0284c7;">≥ ${parseFloat(c.target_score).toFixed(1)}</span></td>
              <td class="dosen-admin-only">${deleteBtn}</td>
            </tr>
          `);
        });

        if (currentUser && currentUser.role === 'mahasiswa') {
          $('.dosen-admin-only').hide();
        }
      },
      error: function () {
        tbody.html('<tr><td colspan="4" style="text-align: center; color: #ef4444;">Gagal memuat CPL mata kuliah</td></tr>');
      }
    });
  }

  // Tambah CPL baru
  $('#addCplForm').on('submit', function (e) {
    e.preventDefault();
    if (!currentCourseIdForCPL) return;

    const code = $('#inputCplCode').val().trim();
    const description = $('#inputCplDesc').val().trim();
    const targetScore = parseFloat($('#inputCplTarget').val()) || 70.0;

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('...');

    $.ajax({
      url: `/api/private/courses/${currentCourseIdForCPL}/cpls`,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ code, description, target_score: targetScore }),
      success: function (res) {
        submitBtn.prop('disabled', false).text('Tambah');
        $('#addCplForm')[0].reset();
        $('#inputCplTarget').val('70');
        showAlert('#cplModalAlert', res.message || 'CPL berhasil ditambahkan', 'success');
        loadCourseCPLs(currentCourseIdForCPL);
        loadCourses(); // Refresh count di tabel utama
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Tambah');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menambahkan CPL';
        showAlert('#cplModalAlert', errMsg, 'danger');
      }
    });
  });

  // Buat CPL standar otomatis
  $('#btnGenerateDefaultCPL').on('click', function () {
    if (!currentCourseIdForCPL) return;

    const btn = $(this);
    btn.prop('disabled', true).text('Membuat CPL...');

    $.ajax({
      url: `/api/private/courses/${currentCourseIdForCPL}/cpls/default`,
      type: 'POST',
      contentType: 'application/json',
      success: function (res) {
        btn.prop('disabled', false).text('✨ Buat CPL Standar Otomatis');
        showAlert('#cplModalAlert', res.message || 'CPL standar berhasil dibuat', 'success');
        loadCourseCPLs(currentCourseIdForCPL);
        loadCourses();
      },
      error: function (xhr) {
        btn.prop('disabled', false).text('✨ Buat CPL Standar Otomatis');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal membuat CPL standar';
        showAlert('#cplModalAlert', errMsg, 'danger');
      }
    });
  });

  // Hapus CPL
  $(document).on('click', '.btn-delete-cpl', function () {
    const id = $(this).data('id');
    const code = $(this).data('code');

    if (confirm(`Apakah Anda yakin ingin menghapus ${code}?`)) {
      $.ajax({
        url: `/api/private/cpls/${id}`,
        type: 'DELETE',
        success: function (res) {
          showAlert('#cplModalAlert', res.message || 'CPL berhasil dihapus', 'success');
          loadCourseCPLs(currentCourseIdForCPL);
          loadCourses();
        },
        error: function (xhr) {
          const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menghapus CPL';
          showAlert('#cplModalAlert', errMsg, 'danger');
        }
      });
    }
  });
});

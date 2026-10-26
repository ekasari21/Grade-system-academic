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
          tbody.append('<tr><td colspan="5" class="text-center" style="text-align: center; color: var(--text-muted);">Tidak ada data mata kuliah</td></tr>');
          return;
        }

        res.data.forEach((course, index) => {
          let actionButtons = '-';
          if (currentUser && currentUser.role !== 'mahasiswa') {
            actionButtons = `
              <button class="btn btn-secondary btn-sm btn-edit-course" data-id="${course.id}" data-code="${course.code}" data-name="${course.name}" data-credits="${course.credits}">Edit</button>
              <button class="btn btn-danger btn-sm btn-delete-course" data-id="${course.id}" data-name="${course.name}">Hapus</button>
            `;
          }

          tbody.append(`
            <tr>
              <td>${index + 1}</td>
              <td><strong>${course.code}</strong></td>
              <td>${course.name}</td>
              <td>${course.credits} SKS</td>
              <td class="dosen-admin-only">${actionButtons}</td>
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

  // Buka modal tambah
  $('#btnOpenAddCourse').on('click', function () {
    $('#courseModalTitle').text('Tambah Mata Kuliah Baru');
    $('#courseForm')[0].reset();
    $('#courseId').val('');
    $('#courseModal').addClass('active');
  });

  // Tutup modal
  $('.btn-close-modal').on('click', function () {
    $('#courseModal').removeClass('active');
  });

  // Klik tombol Edit
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
});

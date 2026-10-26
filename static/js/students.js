$(document).ready(function () {
  initAuth().done(function () {
    loadStudents();
  });

  // Muat daftar mahasiswa
  function loadStudents(search = '') {
    const url = search ? `/api/private/students?search=${encodeURIComponent(search)}` : '/api/private/students';

    $.ajax({
      url: url,
      type: 'GET',
      success: function (res) {
        const tbody = $('#studentTableBody');
        tbody.empty();

        if (!res.data || res.data.length === 0) {
          tbody.append('<tr><td colspan="5" class="text-center" style="text-align: center; color: var(--text-muted);">Tidak ada data mahasiswa</td></tr>');
          return;
        }

        res.data.forEach((student, index) => {
          let actionButtons = '-';
          if (currentUser && currentUser.role !== 'mahasiswa') {
            actionButtons = `
              <button class="btn btn-secondary btn-sm btn-edit" data-id="${student.id}" data-nim="${student.nim}" data-name="${student.name}" data-major="${student.major}">Edit</button>
              <button class="btn btn-danger btn-sm btn-delete" data-id="${student.id}" data-name="${student.name}">Hapus</button>
            `;
          }

          tbody.append(`
            <tr>
              <td>${index + 1}</td>
              <td><strong>${student.nim}</strong></td>
              <td>${student.name}</td>
              <td>${student.major}</td>
              <td class="dosen-admin-only">${actionButtons}</td>
            </tr>
          `);
        });

        if (currentUser && currentUser.role === 'mahasiswa') {
          $('.dosen-admin-only').hide();
        }
      },
      error: function () {
        showAlert('#studentAlert', 'Gagal memuat data mahasiswa');
      }
    });
  }

  // Event pencarian mahasiswa
  let searchTimeout;
  $('#searchStudent').on('input', function () {
    clearTimeout(searchTimeout);
    const query = $(this).val();
    searchTimeout = setTimeout(() => {
      loadStudents(query);
    }, 300);
  });

  // Buka modal tambah mahasiswa
  $('#btnOpenAddStudent').on('click', function () {
    $('#studentModalTitle').text('Tambah Mahasiswa Baru');
    $('#studentForm')[0].reset();
    $('#studentId').val('');
    $('#studentModal').addClass('active');
  });

  // Tutup modal
  $('.btn-close-modal').on('click', function () {
    $('#studentModal').removeClass('active');
  });

  // Klik tombol Edit
  $(document).on('click', '.btn-edit', function () {
    const id = $(this).data('id');
    const nim = $(this).data('nim');
    const name = $(this).data('name');
    const major = $(this).data('major');

    $('#studentModalTitle').text('Edit Data Mahasiswa');
    $('#studentId').val(id);
    $('#inputNIM').val(nim);
    $('#inputName').val(name);
    $('#inputMajor').val(major);
    $('#studentModal').addClass('active');
  });

  // Simpan data (Tambah / Edit)
  $('#studentForm').on('submit', function (e) {
    e.preventDefault();

    const id = $('#studentId').val();
    const nim = $('#inputNIM').val().trim();
    const name = $('#inputName').val().trim();
    const major = $('#inputMajor').val().trim();

    const isEdit = id !== '';
    const url = isEdit ? `/api/private/students/${id}` : '/api/private/students';
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('Menyimpan...');

    $.ajax({
      url: url,
      type: method,
      contentType: 'application/json',
      data: JSON.stringify({ nim, name, major }),
      success: function (res) {
        submitBtn.prop('disabled', false).text('Simpan');
        $('#studentModal').removeClass('active');
        showAlert('#studentAlert', res.message || 'Data berhasil disimpan', 'success');
        loadStudents($('#searchStudent').val());
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Simpan');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menyimpan data';
        alert(errMsg);
      }
    });
  });

  // Hapus Mahasiswa
  $(document).on('click', '.btn-delete', function () {
    const id = $(this).data('id');
    const name = $(this).data('name');

    if (confirm(`Apakah Anda yakin ingin menghapus mahasiswa: ${name}?`)) {
      $.ajax({
        url: `/api/private/students/${id}`,
        type: 'DELETE',
        success: function (res) {
          showAlert('#studentAlert', res.message || 'Mahasiswa berhasil dihapus', 'success');
          loadStudents($('#searchStudent').val());
        },
        error: function (xhr) {
          const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Gagal menghapus mahasiswa';
          showAlert('#studentAlert', errMsg);
        }
      });
    }
  });
});

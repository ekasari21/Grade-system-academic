$(document).ready(function () {
  // 1. Form Login
  $('#loginForm').on('submit', function (e) {
    e.preventDefault();

    const email = $('#loginEmail').val().trim();
    const password = $('#loginPassword').val();

    if (!email || !password) {
      showAlert('#authAlert', 'Email dan password wajib diisi');
      return;
    }

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('Memproses...');

    $.ajax({
      url: '/api/auth/login',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ email, password }),
      success: function (res) {
        window.location.href = '/';
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Masuk');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat login';
        showAlert('#authAlert', errMsg);
      }
    });
  });

  // 2. Toggle form NIM & Jurusan saat memilih role di Register
  $('#registerRole').on('change', function () {
    if ($(this).val() === 'mahasiswa') {
      $('#studentFields').slideDown();
      $('#registerNIM').prop('required', true);
    } else {
      $('#studentFields').slideUp();
      $('#registerNIM').prop('required', false);
    }
  });

  // 3. Form Register
  $('#registerForm').on('submit', function (e) {
    e.preventDefault();

    const name = $('#registerName').val().trim();
    const email = $('#registerEmail').val().trim();
    const password = $('#registerPassword').val();
    const role = $('#registerRole').val();
    const nim = $('#registerNIM').val().trim();
    const major = $('#registerMajor').val().trim();

    if (!name || !email || !password) {
      showAlert('#authAlert', 'Nama, email, dan password wajib diisi');
      return;
    }

    const payload = {
      name: name,
      email: email,
      password: password,
      role: role,
      nim: nim,
      major: major
    };

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('Mendaftarkan...');

    $.ajax({
      url: '/api/auth/register',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
      success: function (res) {
        showAlert('#authAlert', 'Registrasi berhasil! Silakan masuk...', 'success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Daftar Akun');
        const errMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat registrasi';
        showAlert('#authAlert', errMsg);
      }
    });
  });
});

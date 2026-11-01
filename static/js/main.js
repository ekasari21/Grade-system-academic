// Helper membaca nilai cookie berdasarkan nama
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

// Konfigurasi Global jQuery AJAX
$.ajaxSetup({
  xhrFields: {
    withCredentials: true // Wajib agar Cookie HttpOnly JWT selalu dikirim
  },
  beforeSend: function (xhr, settings) {
    // Sisipkan header X-CSRF-Token untuk request pengubah data
    if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }
    }
  }
});

// Helper menampilkan pesan alert
function showAlert(selector, message, type = 'danger') {
  const alertBox = $(selector);
  alertBox.removeClass('alert-success alert-danger')
    .addClass(type === 'success' ? 'alert-success' : 'alert-danger')
    .text(message)
    .fadeIn();

  setTimeout(() => {
    alertBox.fadeOut();
  }, 4500);
}

// Global user profile state
let currentUser = null;

// Memeriksa autentikasi sesi dan mengisi identitas di sidebar
function initAuth(requiredRoles = []) {
  return $.ajax({
    url: '/api/auth/me',
    type: 'GET',
    success: function (res) {
      currentUser = res.user;
      $('#sidebarUserName').text(currentUser.name);
      $('#sidebarUserRole').text(currentUser.role.toUpperCase());

      // Jika role mahasiswa, sembunyikan tombol mutasi data (Dosen/Admin only)
      if (currentUser.role === 'mahasiswa') {
        $('.dosen-admin-only').hide();
      }

      // Periksa hak akses halaman
      if (requiredRoles.length > 0 && !requiredRoles.includes(currentUser.role)) {
        alert('Anda tidak memiliki izin untuk mengakses halaman ini.');
        window.location.href = '/';
      }
    },
    error: function () {
      // Jika sesi tidak valid, alihkan ke halaman login
      window.location.href = '/login';
    }
  });
}

// Fungsi Logout
function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar?')) {
    $.ajax({
      url: '/api/auth/logout',
      type: 'POST',
      success: function () {
        window.location.href = '/login';
      },
      error: function () {
        window.location.href = '/login';
      }
    });
  }
}

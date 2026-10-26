$(document).ready(function () {
  // Inisialisasi autentikasi
  initAuth().done(function () {
    loadDashboardSummary();
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
});

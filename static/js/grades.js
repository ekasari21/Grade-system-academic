$(document).ready(function () {
  initAuth().done(function () {
    loadFilterOptions();
    loadGrades();
  });

  // Muat opsi dropdown filter dan modal
  function loadFilterOptions() {
    // Muat daftar mata kuliah untuk filter & form
    $.ajax({
      url: '/api/private/courses',
      type: 'GET',
      success: function (res) {
        const filterCourse = $('#filterCourse');
        const inputCourse = $('#gradeCourseId');

        filterCourse.find('option:not(:first)').remove();
        inputCourse.find('option:not(:first)').remove();

        (res.data || []).forEach(c => {
          filterCourse.append(`<option value="${c.id}">${c.code} - ${c.name}</option>`);
          inputCourse.append(`<option value="${c.id}">${c.code} - ${c.name} (${c.credits} SKS)</option>`);
        });
      }
    });

    // Muat daftar mahasiswa untuk form input nilai
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

  // Hitung nilai akhir dan grade berdasarkan bobot
  function calculateFinalScore(assignment, quiz, midterm, finalExam) {
    const final = (assignment * 0.20) + (quiz * 0.20) + (midterm * 0.25) + (finalExam * 0.35);
    return parseFloat(final.toFixed(2));
  }

  // Tentukan huruf grade & predikat dari nilai akhir
  function getGradeAndPredikat(score) {
    if (score >= 85) return { letter: 'A', predikat: 'Sangat Baik' };
    if (score >= 80) return { letter: 'AB', predikat: 'Baik Sekali' };
    if (score >= 75) return { letter: 'B', predikat: 'Baik' };
    if (score >= 70) return { letter: 'BC', predikat: 'Cukup Baik' };
    if (score >= 65) return { letter: 'C', predikat: 'Cukup' };
    if (score >= 50) return { letter: 'D', predikat: 'Kurang' };
    return { letter: 'E', predikat: 'Sangat Kurang' };
  }

  // Update preview nilai akhir di modal (real-time)
  function updateModalScorePreview() {
    const assignment = parseFloat($('#inputAssignment').val()) || 0;
    const quiz = parseFloat($('#inputQuiz').val()) || 0;
    const midterm = parseFloat($('#inputMidterm').val()) || 0;
    const finalExam = parseFloat($('#inputFinalExam').val()) || 0;

    const finalScore = calculateFinalScore(assignment, quiz, midterm, finalExam);
    const grade = getGradeAndPredikat(finalScore);

    $('#previewScore').text(finalScore.toFixed(2));
    $('#previewLetter').text(`${grade.letter} (${grade.predikat})`);
  }

  // Event input real-time untuk preview nilai
  $('#inputAssignment, #inputQuiz, #inputMidterm, #inputFinalExam').on('input', function () {
    updateModalScorePreview();
  });

  // Muat daftar penilaian
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

        if (!res.data || res.data.length === 0) {
          tbody.append('<tr><td colspan="11" class="text-center" style="text-align: center; color: var(--text-muted);">Tidak ada data penilaian</td></tr>');
          return;
        }

        res.data.forEach((g, index) => {
          const studentName = g.student ? `${g.student.name} (${g.student.nim})` : '-';
          const courseName = g.course ? `${g.course.code} - ${g.course.name}` : '-';

          let actionButtons = '-';
          if (currentUser && currentUser.role !== 'mahasiswa') {
            actionButtons = `
              <button class="btn btn-secondary btn-sm btn-edit-grade" 
                data-id="${g.id}" 
                data-student-id="${g.student_id}" 
                data-course-id="${g.course_id}" 
                data-assignment="${g.assignment}" 
                data-quiz="${g.quiz}" 
                data-midterm="${g.midterm}" 
                data-final-exam="${g.final_exam}">Edit</button>
              <button class="btn btn-danger btn-sm btn-delete-grade" data-id="${g.id}">Hapus</button>
            `;
          }

          tbody.append(`
            <tr>
              <td>${index + 1}</td>
              <td><strong>${studentName}</strong></td>
              <td>${courseName}</td>
              <td>${g.assignment.toFixed(2)}</td>
              <td>${g.quiz.toFixed(2)}</td>
              <td>${g.midterm.toFixed(2)}</td>
              <td>${g.final_exam.toFixed(2)}</td>
              <td><strong>${g.final_score.toFixed(2)}</strong></td>
              <td><span class="badge-grade badge-${g.letter_grade}">${g.letter_grade}</span></td>
              <td>${g.predicate}</td>
              <td class="dosen-admin-only">${actionButtons}</td>
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

  // Kalkulator preview interaktif di dalam modal
  function updateModalScorePreview() {
    const tugas = parseFloat($('#inputAssignment').val()) || 0;
    const kuis = parseFloat($('#inputQuiz').val()) || 0;
    const uts = parseFloat($('#inputMidterm').val()) || 0;
    const uas = parseFloat($('#inputFinalExam').val()) || 0;

    const finalScore = (tugas * 0.20) + (kuis * 0.20) + (uts * 0.25) + (uas * 0.35);
    const rounded = Math.round(finalScore * 100) / 100;

    let letter = 'E';
    let predicate = 'Sangat Kurang';

    if (rounded >= 85) { letter = 'A'; predicate = 'Sangat Baik'; }
    else if (rounded >= 80) { letter = 'AB'; predicate = 'Baik Sekali'; }
    else if (rounded >= 75) { letter = 'B'; predicate = 'Baik'; }
    else if (rounded >= 70) { letter = 'BC'; predicate = 'Cukup Baik'; }
    else if (rounded >= 65) { letter = 'C'; predicate = 'Cukup'; }
    else if (rounded >= 50) { letter = 'D'; predicate = 'Kurang'; }

    $('#previewScore').text(rounded.toFixed(2));
    $('#previewLetter').text(`${letter} (${predicate})`);
  }

  $('#inputAssignment, #inputQuiz, #inputMidterm, #inputFinalExam').on('input', updateModalScorePreview);

  // Buka modal input nilai baru
  $('#btnOpenAddGrade').on('click', function () {
    $('#gradeModalTitle').text('Input Penilaian Mahasiswa');
    $('#gradeForm')[0].reset();
    $('#gradeId').val('');
    $('#gradeStudentId').prop('disabled', false);
    $('#gradeCourseId').prop('disabled', false);
    updateModalScorePreview();
    $('#gradeModal').addClass('active');
  });

  // Tutup modal
  $('.btn-close-modal').on('click', function () {
    $('#gradeModal').removeClass('active');
  });

  // Edit Nilai
  $(document).on('click', '.btn-edit-grade', function () {
    const id = $(this).data('id');
    const studentId = $(this).data('student-id');
    const courseId = $(this).data('course-id');
    const assignment = $(this).data('assignment');
    const quiz = $(this).data('quiz');
    const midterm = $(this).data('midterm');
    const finalExam = $(this).data('final-exam');

    $('#gradeModalTitle').text('Edit Penilaian Mahasiswa');
    $('#gradeId').val(id);
    $('#gradeStudentId').val(studentId).prop('disabled', true);
    $('#gradeCourseId').val(courseId).prop('disabled', true);
    $('#inputAssignment').val(assignment);
    $('#inputQuiz').val(quiz);
    $('#inputMidterm').val(midterm);
    $('#inputFinalExam').val(finalExam);

    updateModalScorePreview();
    $('#gradeModal').addClass('active');
  });

  // Simpan nilai
  $('#gradeForm').on('submit', function (e) {
    e.preventDefault();

    const id = $('#gradeId').val();
    const studentId = parseInt($('#gradeStudentId').val(), 10);
    const courseId = parseInt($('#gradeCourseId').val(), 10);
    const assignment = parseFloat($('#inputAssignment').val()) || 0;
    const quiz = parseFloat($('#inputQuiz').val()) || 0;
    const midterm = parseFloat($('#inputMidterm').val()) || 0;
    const finalExam = parseFloat($('#inputFinalExam').val()) || 0;

    if (!studentId || !courseId) {
      alert('Pilih mahasiswa dan mata kuliah');
      return;
    }

    const isEdit = id !== '';
    const url = isEdit ? `/api/private/grades/${id}` : '/api/private/grades';
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = $(this).find('button[type="submit"]');
    submitBtn.prop('disabled', true).text('Menghitung & Menyimpan...');

    $.ajax({
      url: url,
      type: method,
      contentType: 'application/json',
      data: JSON.stringify({
        student_id: studentId,
        course_id: courseId,
        assignment: assignment,
        quiz: quiz,
        midterm: midterm,
        final_exam: finalExam
      }),
      success: function (res) {
        submitBtn.prop('disabled', false).text('Simpan Penilaian');
        $('#gradeModal').removeClass('active');
        showAlert('#gradeAlert', res.message || 'Nilai berhasil disimpan', 'success');
        loadGrades();
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).text('Simpan Penilaian');
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
});

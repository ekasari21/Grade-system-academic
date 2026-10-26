package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/services"
)

// GradeController menangani input nilai, perhitungan otomatis, dan rekap penilaian
type GradeController struct{}

// NewGradeController membuat instance baru GradeController
func NewGradeController() *GradeController {
	return &GradeController{}
}

// GradeInput mendefinisikan payload data untuk input/edit nilai
type GradeInput struct {
	StudentID  uint    `json:"student_id" binding:"required"`
	CourseID   uint    `json:"course_id" binding:"required"`
	Assignment float64 `json:"assignment"` // Tugas (Bobot 20%)
	Quiz       float64 `json:"quiz"`       // Kuis (Bobot 20%)
	Midterm    float64 `json:"midterm"`    // UTS (Bobot 25%)
	FinalExam  float64 `json:"final_exam"` // UAS (Bobot 35%)
}

// GetGrades mengambil daftar nilai dengan filter pencarian dan pembatasan role
func (gc *GradeController) GetGrades(c *gin.Context) {
	role := c.GetString("role")
	userID := c.GetUint("userID")

	query := config.DB.Model(&models.Grade{}).
		Preload("Student").
		Preload("Course")

	// Pembatasan akses: Mahasiswa HANYA dapat melihat nilainya sendiri
	if role == models.RoleMahasiswa {
		var student models.Student
		if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil {
			// Mahasiswa belum memiliki data profil yang tertaut
			c.JSON(http.StatusOK, gin.H{"data": []models.Grade{}, "total": 0})
			return
		}
		query = query.Where("student_id = ?", student.ID)
	} else {
		// Dosen & Admin dapat memfilter berdasarkan pencarian teks, mata kuliah, dan grade
		search := strings.TrimSpace(c.Query("search"))
		courseIDStr := strings.TrimSpace(c.Query("course_id"))
		letterGrade := strings.ToUpper(strings.TrimSpace(c.Query("letter_grade")))

		if search != "" {
			searchPattern := "%" + search + "%"
			// Filter berdasarkan nama atau NIM mahasiswa via join
			query = query.Joins("JOIN students ON students.id = grades.student_id").
				Where("students.name ILIKE ? OR students.nim ILIKE ?", searchPattern, searchPattern)
		}

		if courseIDStr != "" {
			if cid, err := strconv.ParseUint(courseIDStr, 10, 32); err == nil {
				query = query.Where("grades.course_id = ?", cid)
			}
		}

		if letterGrade != "" {
			query = query.Where("grades.letter_grade = ?", letterGrade)
		}
	}

	var grades []models.Grade
	if err := query.Order("grades.created_at DESC").Find(&grades).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data penilaian"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  grades,
		"total": len(grades),
	})
}

// GetGradeByID mengambil detail satu penilaian dengan verifikasi kepemilikan
func (gc *GradeController) GetGradeByID(c *gin.Context) {
	id := c.Param("id")
	role := c.GetString("role")
	userID := c.GetUint("userID")

	var grade models.Grade
	if err := config.DB.Preload("Student").Preload("Course").First(&grade, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penilaian tidak ditemukan"})
		return
	}

	// Jika role mahasiswa, periksa apakah nilai ini miliknya
	if role == models.RoleMahasiswa {
		var student models.Student
		if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil || grade.StudentID != student.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda hanya dapat melihat nilai milik Anda sendiri"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": grade})
}

// CreateGrade menginput nilai mahasiswa dan menghitung nilai akhir secara otomatis (Dosen/Admin)
func (gc *GradeController) CreateGrade(c *gin.Context) {
	var input GradeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	// 1. Verifikasi keberadaan mahasiswa dan mata kuliah
	var student models.Student
	if err := config.DB.First(&student, input.StudentID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mahasiswa dengan ID tersebut tidak ditemukan"})
		return
	}

	var course models.Course
	if err := config.DB.First(&course, input.CourseID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mata kuliah dengan ID tersebut tidak ditemukan"})
		return
	}

	// 2. Periksa apakah sudah ada nilai untuk kombinasi mahasiswa dan mata kuliah ini
	var existing models.Grade
	if err := config.DB.Where("student_id = ? AND course_id = ?", input.StudentID, input.CourseID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Nilai untuk mahasiswa pada mata kuliah ini sudah pernah diinput. Silakan perbarui nilai melalui menu edit.",
		})
		return
	}

	// 3. Jalankan kalkulasi nilai akhir dan konversi huruf via Calculation Service
	calcResult, err := services.CalculateGrade(input.Assignment, input.Quiz, input.Midterm, input.FinalExam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	grade := models.Grade{
		StudentID:   input.StudentID,
		CourseID:    input.CourseID,
		Assignment:  input.Assignment,
		Quiz:        input.Quiz,
		Midterm:     input.Midterm,
		FinalExam:   input.FinalExam,
		FinalScore:  calcResult.FinalScore,
		LetterGrade: calcResult.LetterGrade,
		Predicate:   calcResult.Predicate,
		Status:      "Lengkap",
	}

	if err := config.DB.Create(&grade).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data nilai"})
		return
	}

	// Muat data relasi untuk respons
	_ = config.DB.Preload("Student").Preload("Course").First(&grade, grade.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Nilai berhasil dihitung dan disimpan",
		"data":    grade,
	})
}

// UpdateGrade memperbarui nilai dan menghitung ulang nilai akhir secara otomatis (Dosen/Admin)
func (gc *GradeController) UpdateGrade(c *gin.Context) {
	id := c.Param("id")

	var grade models.Grade
	if err := config.DB.First(&grade, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penilaian tidak ditemukan"})
		return
	}

	var input GradeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	// Jalankan kalkulasi ulang nilai akhir dan konversi huruf
	calcResult, err := services.CalculateGrade(input.Assignment, input.Quiz, input.Midterm, input.FinalExam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	grade.Assignment = input.Assignment
	grade.Quiz = input.Quiz
	grade.Midterm = input.Midterm
	grade.FinalExam = input.FinalExam
	grade.FinalScore = calcResult.FinalScore
	grade.LetterGrade = calcResult.LetterGrade
	grade.Predicate = calcResult.Predicate
	grade.Status = "Lengkap"

	if err := config.DB.Save(&grade).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data penilaian"})
		return
	}

	_ = config.DB.Preload("Student").Preload("Course").First(&grade, grade.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Data nilai berhasil diperbarui dan dihitung ulang",
		"data":    grade,
	})
}

// DeleteGrade menghapus data penilaian secara soft-delete (Dosen/Admin)
func (gc *GradeController) DeleteGrade(c *gin.Context) {
	id := c.Param("id")

	var grade models.Grade
	if err := config.DB.First(&grade, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penilaian tidak ditemukan"})
		return
	}

	if err := config.DB.Delete(&grade).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data penilaian"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data penilaian berhasil dihapus",
	})
}

package controllers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
)

// StudentController menangani operasi CRUD data mahasiswa
type StudentController struct{}

// NewStudentController membuat instance baru StudentController
func NewStudentController() *StudentController {
	return &StudentController{}
}

// StudentInput mendefinisikan payload data pembuatan/pembaruan mahasiswa
type StudentInput struct {
	NIM   string `json:"nim" binding:"required"`
	Name  string `json:"name" binding:"required"`
	Major string `json:"major" binding:"required"`
}

// GetStudents mengambil daftar mahasiswa dengan dukungan pencarian nama/NIM
func (sc *StudentController) GetStudents(c *gin.Context) {
	search := strings.TrimSpace(c.Query("search"))

	var students []models.Student
	query := config.DB.Model(&models.Student{})

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name ILIKE ? OR nim ILIKE ?", searchPattern, searchPattern)
	}

	if err := query.Order("name ASC").Find(&students).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mahasiswa"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  students,
		"total": len(students),
	})
}

// GetStudentByID mengambil detail satu mahasiswa beserta daftar nilainya
func (sc *StudentController) GetStudentByID(c *gin.Context) {
	id := c.Param("id")

	var student models.Student
	if err := config.DB.Preload("Grades.Course").First(&student, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mahasiswa tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": student})
}

// CreateStudent menambahkan data mahasiswa baru (khusus Dosen/Admin)
func (sc *StudentController) CreateStudent(c *gin.Context) {
	var input StudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	input.NIM = strings.TrimSpace(input.NIM)
	input.Name = strings.TrimSpace(input.Name)
	input.Major = strings.TrimSpace(input.Major)

	// Periksa apakah NIM sudah terdaftar
	var existing models.Student
	if err := config.DB.Where("nim = ?", input.NIM).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIM sudah terdaftar"})
		return
	}

	student := models.Student{
		NIM:   input.NIM,
		Name:  input.Name,
		Major: input.Major,
	}

	if err := config.DB.Create(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data mahasiswa"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Data mahasiswa berhasil ditambahkan",
		"data":    student,
	})
}

// UpdateStudent memperbarui data mahasiswa (khusus Dosen/Admin)
func (sc *StudentController) UpdateStudent(c *gin.Context) {
	id := c.Param("id")

	var student models.Student
	if err := config.DB.First(&student, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mahasiswa tidak ditemukan"})
		return
	}

	var input StudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	input.NIM = strings.TrimSpace(input.NIM)
	input.Name = strings.TrimSpace(input.Name)
	input.Major = strings.TrimSpace(input.Major)

	// Pastikan NIM tidak bentrok dengan mahasiswa lain
	var duplicate models.Student
	if err := config.DB.Where("nim = ? AND id != ?", input.NIM, student.ID).First(&duplicate).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "NIM sudah digunakan oleh mahasiswa lain"})
		return
	}

	student.NIM = input.NIM
	student.Name = input.Name
	student.Major = input.Major

	if err := config.DB.Save(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data mahasiswa"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data mahasiswa berhasil diperbarui",
		"data":    student,
	})
}

// DeleteStudent menghapus data mahasiswa secara soft-delete (khusus Dosen/Admin)
func (sc *StudentController) DeleteStudent(c *gin.Context) {
	id := c.Param("id")

	var student models.Student
	if err := config.DB.First(&student, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mahasiswa tidak ditemukan"})
		return
	}

	// Soft delete data mahasiswa
	if err := config.DB.Delete(&student).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data mahasiswa"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data mahasiswa berhasil dihapus",
	})
}

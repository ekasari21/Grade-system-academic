package controllers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
)

// CourseController menangani operasi CRUD data mata kuliah
type CourseController struct{}

// NewCourseController membuat instance baru CourseController
func NewCourseController() *CourseController {
	return &CourseController{}
}

// CourseInput mendefinisikan payload data pembuatan/pembaruan mata kuliah
type CourseInput struct {
	Code    string `json:"code" binding:"required"`
	Name    string `json:"name" binding:"required"`
	Credits int    `json:"credits" binding:"required,min=1,max=6"`
}

// GetCourses mengambil seluruh daftar mata kuliah
func (cc *CourseController) GetCourses(c *gin.Context) {
	var courses []models.Course
	if err := config.DB.Preload("CPLs").Order("code ASC").Find(&courses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mata kuliah"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  courses,
		"total": len(courses),
	})
}

// GetCourseByID mengambil detail satu mata kuliah
func (cc *CourseController) GetCourseByID(c *gin.Context) {
	id := c.Param("id")

	var course models.Course
	if err := config.DB.Preload("CPLs").First(&course, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mata kuliah tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": course})
}

// CreateCourse menambahkan mata kuliah baru (khusus Dosen/Admin)
func (cc *CourseController) CreateCourse(c *gin.Context) {
	var input CourseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	code := strings.ToUpper(strings.TrimSpace(input.Code))
	name := strings.TrimSpace(input.Name)

	// Pastikan kode mata kuliah unik
	var existing models.Course
	if err := config.DB.Where("code = ?", code).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode mata kuliah sudah ada"})
		return
	}

	course := models.Course{
		Code:    code,
		Name:    name,
		Credits: input.Credits,
	}

	if err := config.DB.Create(&course).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan mata kuliah"})
		return
	}

	// Buat CPL standar default untuk mata kuliah baru
	defaultCPLs := []models.CourseCPL{
		{
			CourseID:    course.ID,
			Code:        "CPL-1",
			Description: "Penguasaan konsep teoritis dasar dan prinsip keilmuan mata kuliah",
			TargetScore: 65.00,
		},
		{
			CourseID:    course.ID,
			Code:        "CPL-2",
			Description: "Keterampilan analisis permasalahan dan penerapan metodologi",
			TargetScore: 65.00,
		},
		{
			CourseID:    course.ID,
			Code:        "CPL-3",
			Description: "Kemampuan merancang, mengimplementasikan, dan mengevaluasi solusi",
			TargetScore: 65.00,
		},
		{
			CourseID:    course.ID,
			Code:        "CPL-4",
			Description: "Kemampuan komunikasi, etika profesi, dan dokumentasi akademik",
			TargetScore: 65.00,
		},
	}
	_ = config.DB.Create(&defaultCPLs)
	_ = config.DB.Preload("CPLs").First(&course, course.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Mata kuliah dan CPL standar berhasil ditambahkan",
		"data":    course,
	})
}

// UpdateCourse memperbarui data mata kuliah (khusus Dosen/Admin)
func (cc *CourseController) UpdateCourse(c *gin.Context) {
	id := c.Param("id")

	var course models.Course
	if err := config.DB.First(&course, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mata kuliah tidak ditemukan"})
		return
	}

	var input CourseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	code := strings.ToUpper(strings.TrimSpace(input.Code))
	name := strings.TrimSpace(input.Name)

	// Pastikan kode tidak duplikat dengan mata kuliah lain
	var duplicate models.Course
	if err := config.DB.Where("code = ? AND id != ?", code, course.ID).First(&duplicate).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode mata kuliah sudah digunakan oleh mata kuliah lain"})
		return
	}

	course.Code = code
	course.Name = name
	course.Credits = input.Credits

	if err := config.DB.Save(&course).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data mata kuliah"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data mata kuliah berhasil diperbarui",
		"data":    course,
	})
}

// DeleteCourse menghapus mata kuliah secara soft-delete (khusus Dosen/Admin)
func (cc *CourseController) DeleteCourse(c *gin.Context) {
	id := c.Param("id")

	var course models.Course
	if err := config.DB.First(&course, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data mata kuliah tidak ditemukan"})
		return
	}

	if err := config.DB.Delete(&course).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data mata kuliah"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data mata kuliah berhasil dihapus",
	})
}

package controllers

import (
	"fmt"
	"math"
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

// GetSampleNIMs mengambil daftar sampel NIM mahasiswa untuk mempermudah pengujian di dashboard publik
func (sc *StudentController) GetSampleNIMs(c *gin.Context) {
	var samples []models.Student
	config.DB.Select("nim, name, major").Order("nim ASC").Limit(10).Find(&samples)
	c.JSON(http.StatusOK, gin.H{
		"data": samples,
	})
}

// PublicCourseGradeItem format data butir komponen penilaian
type PublicCourseGradeItem struct {
	Name     string  `json:"name"`
	Category string  `json:"category"`
	Score    float64 `json:"score"`
	Weight   float64 `json:"weight"`
	CPLCode  string  `json:"cpl_code"`
}

// PublicCourseCPLDetail format data CPL per mata kuliah
type PublicCourseCPLDetail struct {
	CPLCode     string  `json:"cpl_code"`
	CPLDesc     string  `json:"cpl_desc"`
	Score       float64 `json:"score"`
	TargetScore float64 `json:"target_score"`
	Status      string  `json:"status"` // "Tercapai" atau "Belum Tercapai"
	Weight      float64 `json:"weight"`
	Components  string  `json:"components"`
}

// PublicCourseGradeInfo format informasi nilai mata kuliah mahasiswa
type PublicCourseGradeInfo struct {
	CourseID           uint                    `json:"course_id"`
	CourseCode         string                  `json:"course_code"`
	CourseName         string                  `json:"course_name"`
	Credits            int                     `json:"credits"`
	Assignment         float64                 `json:"assignment"`
	Quiz               float64                 `json:"quiz"`
	Midterm            float64                 `json:"midterm"`
	FinalExam          float64                 `json:"final_exam"`
	FinalScore         float64                 `json:"final_score"`
	LetterGrade        string                  `json:"letter_grade"`
	Predicate          string                  `json:"predicate"`
	GradePoint         float64                 `json:"grade_point"`
	Items              []PublicCourseGradeItem `json:"items"`
	CPLDetails         []PublicCourseCPLDetail `json:"cpl_details"`
	CPLAchievedCount   int                     `json:"cpl_achieved_count"`
	CPLTotalCount      int                     `json:"cpl_total_count"`
	CPLAchievementRate float64                 `json:"cpl_achievement_rate"`
}

// GetPublicStudentGrades mencari data nilai dan grafik belajar mahasiswa secara publik berdasarkan NIM
func (sc *StudentController) GetPublicStudentGrades(c *gin.Context) {
	nim := strings.TrimSpace(c.Query("nim"))
	if nim == "" {
		nim = strings.TrimSpace(c.Param("nim"))
	}
	if nim == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nomor Induk Mahasiswa (NIM) wajib diisi"})
		return
	}

	var student models.Student
	if err := config.DB.Where("LOWER(nim) = LOWER(?)", nim).First(&student).Error; err != nil {
		var samples []models.Student
		config.DB.Select("nim, name").Order("nim ASC").Limit(6).Find(&samples)
		c.JSON(http.StatusNotFound, gin.H{
			"error":             fmt.Sprintf("Mahasiswa dengan NIM '%s' tidak ditemukan dalam sistem.", nim),
			"available_samples": samples,
		})
		return
	}

	// Ambil data nilai, mata kuliah, CPL, dan butir komponen penilaian
	var grades []models.Grade
	config.DB.Preload("Course.CPLs").
		Preload("CPLDetails").
		Preload("Items.CourseCPL").
		Where("student_id = ?", student.ID).
		Find(&grades)

	gradePointMap := map[string]float64{
		"A": 4.0, "AB": 3.5, "B": 3.0, "BC": 2.5, "C": 2.0, "D": 1.0, "E": 0.0,
	}

	dist := map[string]int{
		"A": 0, "AB": 0, "B": 0, "BC": 0, "C": 0, "D": 0, "E": 0,
	}

	var totalCredits int
	var totalWeightedPoints float64
	var sumFinalScores float64

	totalCPLEvaluated := 0
	totalCPLAchieved := 0

	// Pengelompokan skor CPL per kode untuk Radar Chart
	cplScoreMap := make(map[string][]float64)
	cplDescMap := make(map[string]string)

	coursesList := make([]PublicCourseGradeInfo, 0, len(grades))

	for _, g := range grades {
		sumFinalScores += g.FinalScore
		credits := 3
		courseCode := "-"
		courseName := "-"
		if g.Course != nil {
			if g.Course.Credits > 0 {
				credits = g.Course.Credits
			}
			courseCode = g.Course.Code
			courseName = g.Course.Name
		}

		gp := gradePointMap[g.LetterGrade]
		totalCredits += credits
		totalWeightedPoints += gp * float64(credits)

		if _, exists := dist[g.LetterGrade]; exists {
			dist[g.LetterGrade]++
		}

		// Kumpulkan butir komponen penilaian
		itemsList := make([]PublicCourseGradeItem, 0, len(g.Items))
		for _, it := range g.Items {
			cplCode := "-"
			if it.CourseCPL != nil {
				cplCode = it.CourseCPL.Code
			}
			itemsList = append(itemsList, PublicCourseGradeItem{
				Name:     it.Name,
				Category: it.Category,
				Score:    it.Score,
				Weight:   it.Weight,
				CPLCode:  cplCode,
			})
		}

		// Kumpulkan detail CPL
		cplList := make([]PublicCourseCPLDetail, 0, len(g.CPLDetails))
		for _, cd := range g.CPLDetails {
			totalCPLEvaluated++
			if cd.Status == "Tercapai" {
				totalCPLAchieved++
			}

			cplScoreMap[cd.CPLCode] = append(cplScoreMap[cd.CPLCode], cd.Score)
			cplDescMap[cd.CPLCode] = cd.CPLDesc

			cplList = append(cplList, PublicCourseCPLDetail{
				CPLCode:     cd.CPLCode,
				CPLDesc:     cd.CPLDesc,
				Score:       cd.Score,
				TargetScore: cd.TargetScore,
				Status:      cd.Status,
				Weight:      cd.Weight,
				Components:  cd.Components,
			})
		}

		coursesList = append(coursesList, PublicCourseGradeInfo{
			CourseID:           g.CourseID,
			CourseCode:         courseCode,
			CourseName:         courseName,
			Credits:            credits,
			Assignment:         g.Assignment,
			Quiz:               g.Quiz,
			Midterm:            g.Midterm,
			FinalExam:          g.FinalExam,
			FinalScore:         g.FinalScore,
			LetterGrade:        g.LetterGrade,
			Predicate:          g.Predicate,
			GradePoint:         gp,
			Items:              itemsList,
			CPLDetails:         cplList,
			CPLAchievedCount:   g.CPLAchievedCount,
			CPLTotalCount:      g.CPLTotalCount,
			CPLAchievementRate: g.CPLAchievementRate,
		})
	}

	// Hitung IPK & Rata-rata
	var ipk float64
	var avgFinalScore float64
	if totalCredits > 0 {
		ipk = math.Round((totalWeightedPoints/float64(totalCredits))*100) / 100
	}
	if len(grades) > 0 {
		avgFinalScore = math.Round((sumFinalScores/float64(len(grades)))*100) / 100
	}

	// Hitung Ketercapaian CPL Mahasiswa
	var cplRate float64
	if totalCPLEvaluated > 0 {
		cplRate = math.Round((float64(totalCPLAchieved)/float64(totalCPLEvaluated))*10000) / 100
	}

	// Predikat Akademik
	academicPredicate := "Belum Ada Nilai"
	if len(grades) > 0 {
		if ipk >= 3.51 {
			academicPredicate = "Dengan Pujian (Cum Laude)"
		} else if ipk >= 3.00 {
			academicPredicate = "Sangat Memuaskan"
		} else if ipk >= 2.50 {
			academicPredicate = "Memuaskan"
		} else if ipk >= 2.00 {
			academicPredicate = "Cukup"
		} else {
			academicPredicate = "Perlu Bimbingan Akademik"
		}
	}

	// Persiapan Chart Data CPL Radar
	type CPLRadarPoint struct {
		Code         string  `json:"code"`
		Description  string  `json:"description"`
		AverageScore float64 `json:"average_score"`
		TargetScore  float64 `json:"target_score"`
		IsAchieved   bool    `json:"is_achieved"`
	}

	radarPoints := make([]CPLRadarPoint, 0, len(cplScoreMap))
	for code, scores := range cplScoreMap {
		var sum float64
		for _, s := range scores {
			sum += s
		}
		avg := sum / float64(len(scores))
		radarPoints = append(radarPoints, CPLRadarPoint{
			Code:         code,
			Description:  cplDescMap[code],
			AverageScore: math.Round(avg*100) / 100,
			TargetScore:  70.0,
			IsAchieved:   avg >= 70.0,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"student": gin.H{
			"id":        student.ID,
			"nim":       student.NIM,
			"name":      student.Name,
			"major":     student.Major,
			"status":    "Aktif",
			"curriculum": "Kurikulum Berbasis Capaian Pembelajaran (OBE)",
		},
		"summary": gin.H{
			"total_courses":       len(grades),
			"total_credits":       totalCredits,
			"average_final_score": avgFinalScore,
			"ipk":                 ipk,
			"academic_predicate":  academicPredicate,
			"cpl_evaluated":       totalCPLEvaluated,
			"cpl_achieved":        totalCPLAchieved,
			"cpl_pass_rate":       cplRate,
			"cpl_is_all_achieved": totalCPLEvaluated > 0 && totalCPLAchieved == totalCPLEvaluated,
			"grade_distribution":  dist,
		},
		"courses":      coursesList,
		"cpl_radar":    radarPoints,
		"retrieved_at": fmt.Sprintf("%d", student.ID),
	})
}

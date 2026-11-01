package controllers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/services"
)

// CPLController menangani operasi CRUD CPL, rekapitulasi ketercapaian kelas, dan simulasi OBE
type CPLController struct{}

// NewCPLController membuat instance baru CPLController
func NewCPLController() *CPLController {
	return &CPLController{}
}

// CPLInput mendefinisikan payload data pembuatan atau pembaruan CPL
type CPLInput struct {
	Code        string  `json:"code" binding:"required"`
	Description string  `json:"description" binding:"required"`
	TargetScore float64 `json:"target_score"`
}

// GetCourseCPLs mengambil seluruh daftar CPL untuk mata kuliah tertentu
func (cc *CPLController) GetCourseCPLs(c *gin.Context) {
	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Koneksi database belum terhubung. Pastikan internet dan database aktif."})
		return
	}

	courseID := c.Param("id")

	var course models.Course
	if err := config.DB.First(&course, courseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mata kuliah tidak ditemukan"})
		return
	}

	var cpls []models.CourseCPL
	if err := config.DB.Where("course_id = ?", course.ID).Order("code ASC, id ASC").Find(&cpls).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data CPL mata kuliah"})
		return
	}

	// Jika mata kuliah belum memiliki CPL, otomatis inisialisasi CPL standar OBE
	if len(cpls) == 0 {
		defaultCPLs := []models.CourseCPL{
			{CourseID: course.ID, Code: "CPL-02", Description: "Keterampilan analisis permasalahan dan penerapan metodologi", TargetScore: services.DefaultCPLTargetScore},
			{CourseID: course.ID, Code: "CPL-03", Description: "Penguasaan konsep teoritis dasar dan prinsip keilmuan", TargetScore: services.DefaultCPLTargetScore},
			{CourseID: course.ID, Code: "CPL-04", Description: "Kemampuan merancang, mengimplementasikan, dan mengevaluasi solusi teknik", TargetScore: services.DefaultCPLTargetScore},
			{CourseID: course.ID, Code: "CPL-05", Description: "Kemampuan evaluasi, inovasi, etika profesi, dan penjaminan mutu", TargetScore: services.DefaultCPLTargetScore},
		}
		for i := range defaultCPLs {
			_ = config.DB.Create(&defaultCPLs[i])
		}
		config.DB.Where("course_id = ?", course.ID).Order("code ASC, id ASC").Find(&cpls)
	}

	c.JSON(http.StatusOK, gin.H{
		"course": course,
		"data":   cpls,
		"total":  len(cpls),
	})
}

// CreateCourseCPL menambahkan CPL baru ke dalam mata kuliah (Dosen/Admin)
func (cc *CPLController) CreateCourseCPL(c *gin.Context) {
	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	var course models.Course
	if err := config.DB.First(&course, courseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mata kuliah tidak ditemukan"})
		return
	}

	var input CPLInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data CPL tidak valid: " + err.Error()})
		return
	}

	code := strings.ToUpper(strings.TrimSpace(input.Code))
	desc := strings.TrimSpace(input.Description)

	targetScore := input.TargetScore
	if targetScore <= 0 {
		targetScore = services.DefaultCPLTargetScore // Standar OBE: 70
	}

	cpl := models.CourseCPL{
		CourseID:    uint(courseID),
		Code:        code,
		Description: desc,
		TargetScore: targetScore,
	}

	if err := config.DB.Create(&cpl).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data CPL"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "CPL berhasil ditambahkan ke mata kuliah",
		"data":    cpl,
	})
}

// UpdateCourseCPL memperbarui data CPL (Dosen/Admin)
func (cc *CPLController) UpdateCourseCPL(c *gin.Context) {
	cplID := c.Param("id")

	var cpl models.CourseCPL
	if err := config.DB.First(&cpl, cplID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPL tidak ditemukan"})
		return
	}

	var input CPLInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data CPL tidak valid: " + err.Error()})
		return
	}

	cpl.Code = strings.ToUpper(strings.TrimSpace(input.Code))
	cpl.Description = strings.TrimSpace(input.Description)
	if input.TargetScore > 0 {
		cpl.TargetScore = input.TargetScore
	}

	if err := config.DB.Save(&cpl).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data CPL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Data CPL berhasil diperbarui",
		"data":    cpl,
	})
}

// DeleteCourseCPL menghapus CPL dari mata kuliah jika belum digunakan dalam penilaian
func (cc *CPLController) DeleteCourseCPL(c *gin.Context) {
	cplID := c.Param("id")

	var cpl models.CourseCPL
	if err := config.DB.First(&cpl, cplID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data CPL tidak ditemukan"})
		return
	}

	var count int64
	config.DB.Model(&models.GradeItem{}).Where("course_cpl_id = ?", cpl.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "CPL ini tidak dapat dihapus karena sudah terhubung ke data penilaian mahasiswa.",
		})
		return
	}

	if err := config.DB.Delete(&cpl).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus CPL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "CPL berhasil dihapus",
	})
}

// GenerateDefaultCPLs membuat CPL standar otomatis dengan target 70 untuk mata kuliah yang belum memilikinya
func (cc *CPLController) GenerateDefaultCPLs(c *gin.Context) {
	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	var course models.Course
	if err := config.DB.First(&course, courseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mata kuliah tidak ditemukan"})
		return
	}

	var count int64
	config.DB.Model(&models.CourseCPL{}).Where("course_id = ?", course.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mata kuliah ini sudah memiliki CPL"})
		return
	}

	defaultCPLs := []models.CourseCPL{
		{
			CourseID:    course.ID,
			Code:        "CPL-02",
			Description: "Keterampilan analisis permasalahan dan penerapan metodologi",
			TargetScore: services.DefaultCPLTargetScore, // 70.00
		},
		{
			CourseID:    course.ID,
			Code:        "CPL-03",
			Description: "Penguasaan konsep teoritis dasar dan prinsip keilmuan mata kuliah",
			TargetScore: services.DefaultCPLTargetScore, // 70.00
		},
		{
			CourseID:    course.ID,
			Code:        "CPL-04",
			Description: "Kemampuan merancang, mengimplementasikan, dan mengevaluasi solusi teknik",
			TargetScore: services.DefaultCPLTargetScore, // 70.00
		},
		{
			CourseID:    course.ID,
			Code:        "CPL-05",
			Description: "Kemampuan evaluasi, inovasi, etika profesi, dan penjaminan mutu",
			TargetScore: services.DefaultCPLTargetScore, // 70.00
		},
	}

	if err := config.DB.Create(&defaultCPLs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat CPL standar"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "CPL standar berhasil dibuat secara otomatis dengan target minimal 70.00",
		"data":    defaultCPLs,
	})
}

// CPLRecapItem menampung metrik rekapitulasi kelas per CPL
type CPLRecapItem struct {
	CPLID          uint     `json:"cpl_id"`
	CPLCode        string   `json:"cpl_code"`
	CPLDesc        string   `json:"cpl_desc"`
	TargetScore    float64  `json:"target_score"`
	TotalAssessed  int      `json:"total_assessed"`
	AverageScore   float64  `json:"average_score"`
	AchievedCount  int      `json:"achieved_count"`
	UnachievedCount int     `json:"unachieved_count"`
	PassRate       float64  `json:"pass_rate"`        // (Lulus / Total) * 100%
	Status         string   `json:"status"`           // "Memenuhi Target" atau "Perlu Evaluasi Mutu"
	FailingStudents []string `json:"failing_students"` // Mahasiswa yang belum tercapai di CPL ini
}

// GetCPLRecap menyajikan rekapitulasi ketercapaian CPL seluruh kelas dan bahan evaluasi pembelajaran (CQI)
func (cc *CPLController) GetCPLRecap(c *gin.Context) {
	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	var course models.Course
	if err := config.DB.Preload("CPLs").First(&course, courseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mata kuliah tidak ditemukan"})
		return
	}

	// Ambil semua penilaian pada mata kuliah ini
	var grades []models.Grade
	config.DB.Preload("Student").Preload("CPLDetails").Preload("Items").Where("course_id = ?", course.ID).Find(&grades)

	// Ambil daftar butir penilaian yang disetting untuk mata kuliah ini
	var assessmentItems []models.CourseAssessmentItem
	config.DB.Preload("CourseCPL").Where("course_id = ?", course.ID).Order("order_index asc, id asc").Find(&assessmentItems)

	totalStudentsAssessed := len(grades)
	recapMap := make(map[uint]*CPLRecapItem)

	for _, cpl := range course.CPLs {
		recapMap[cpl.ID] = &CPLRecapItem{
			CPLID:           cpl.ID,
			CPLCode:         cpl.Code,
			CPLDesc:         cpl.Description,
			TargetScore:     cpl.TargetScore,
			FailingStudents: make([]string, 0),
		}
	}

	cplScoreSums := make(map[uint]float64)
	var sumFinalScores float64
	var highestFinalScore float64 = -1
	var lowestFinalScore float64 = 101
	var highestStudentName string = "-"
	var lowestStudentName string = "-"
	var academicPassCount int

	gradeDistribution := map[string]int{
		"A": 0, "AB": 0, "B": 0, "BC": 0, "C": 0, "D": 0, "E": 0,
	}

	for _, g := range grades {
		studentName := ""
		if g.Student != nil {
			studentName = fmt.Sprintf("%s (%s)", g.Student.Name, g.Student.NIM)
		}

		sumFinalScores += g.FinalScore
		if g.FinalScore >= 70.0 {
			academicPassCount++
		}

		if g.FinalScore > highestFinalScore {
			highestFinalScore = g.FinalScore
			highestStudentName = fmt.Sprintf("%s (%.2f)", studentName, g.FinalScore)
		}
		if g.FinalScore < lowestFinalScore {
			lowestFinalScore = g.FinalScore
			lowestStudentName = fmt.Sprintf("%s (%.2f)", studentName, g.FinalScore)
		}

		if _, exists := gradeDistribution[g.LetterGrade]; exists {
			gradeDistribution[g.LetterGrade]++
		}

		for _, cd := range g.CPLDetails {
			item, exists := recapMap[cd.CourseCPLID]
			if !exists {
				continue
			}
			item.TotalAssessed++
			cplScoreSums[cd.CourseCPLID] += cd.Score

			if cd.Status == "Tercapai" {
				item.AchievedCount++
			} else {
				item.UnachievedCount++
				if studentName != "" {
					item.FailingStudents = append(item.FailingStudents, studentName)
				}
			}
		}
	}

	recapList := make([]CPLRecapItem, 0, len(course.CPLs))
	evaluationItems := make([]string, 0)
	var totalCPLAssessedGlobal int
	var totalCPLAchievedGlobal int

	for _, cpl := range course.CPLs {
		item := recapMap[cpl.ID]
		if item.TotalAssessed > 0 {
			item.AverageScore = math.Round((cplScoreSums[cpl.ID]/float64(item.TotalAssessed))*100) / 100
			item.PassRate = math.Round((float64(item.AchievedCount)/float64(item.TotalAssessed))*10000) / 100
			totalCPLAssessedGlobal += item.TotalAssessed
			totalCPLAchievedGlobal += item.AchievedCount
		}

		// Kriteria CQI OBE: Jika tingkat kelulusan < 75%, tandai perlunya evaluasi pembelajaran
		if item.PassRate >= 75.0 && item.TotalAssessed > 0 {
			item.Status = "Memenuhi Target Mutu (≥75%)"
		} else if item.TotalAssessed > 0 {
			item.Status = "Perlu Evaluasi Mutu (<75%)"
			evaluationItems = append(evaluationItems, fmt.Sprintf("%s (%s): Tingkat ketercapaian kelas hanya %.1f%% (Rata-rata: %.2f)", item.CPLCode, item.CPLDesc, item.PassRate, item.AverageScore))
		} else {
			item.Status = "Belum Ada Data Penilaian"
		}

		recapList = append(recapList, *item)
	}

	type StudentMatrixRow struct {
		StudentID          uint               `json:"student_id"`
		Name               string             `json:"name"`
		NIM                string             `json:"nim"`
		Assignment         float64            `json:"assignment"`
		Quiz               float64            `json:"quiz"`
		Midterm            float64            `json:"midterm"`
		FinalExam          float64            `json:"final_exam"`
		ItemScores         map[string]float64 `json:"item_scores"`
		FinalScore         float64            `json:"final_score"`
		LetterGrade        string             `json:"letter_grade"`
		Predicate          string             `json:"predicate"`
		CPLScores          map[string]float64 `json:"cpl_scores"`
		CPLStatuses        map[string]string  `json:"cpl_statuses"`
		CPLAchievedCount   int                `json:"cpl_achieved_count"`
		CPLTotalCount      int                `json:"cpl_total_count"`
		CPLAchievementRate float64            `json:"cpl_achievement_rate"`
	}

	studentMatrix := make([]StudentMatrixRow, 0, len(grades))
	for _, g := range grades {
		sName := "-"
		sNIM := "-"
		if g.Student != nil {
			sName = g.Student.Name
			sNIM = g.Student.NIM
		}

		scoresMap := make(map[string]float64)
		statusMap := make(map[string]string)
		for _, cd := range g.CPLDetails {
			scoresMap[cd.CPLCode] = cd.Score
			statusMap[cd.CPLCode] = cd.Status
		}

		itemScoresMap := make(map[string]float64)
		for _, it := range g.Items {
			itemScoresMap[it.Name] = it.Score
			itemScoresMap[fmt.Sprintf("item_%d", it.ID)] = it.Score
			itemScoresMap[fmt.Sprintf("cpl_%d", it.CourseCPLID)] = it.Score
		}

		studentMatrix = append(studentMatrix, StudentMatrixRow{
			StudentID:          g.StudentID,
			Name:               sName,
			NIM:                sNIM,
			Assignment:         g.Assignment,
			Quiz:               g.Quiz,
			Midterm:            g.Midterm,
			FinalExam:          g.FinalExam,
			ItemScores:         itemScoresMap,
			FinalScore:         g.FinalScore,
			LetterGrade:        g.LetterGrade,
			Predicate:          g.Predicate,
			CPLScores:          scoresMap,
			CPLStatuses:        statusMap,
			CPLAchievedCount:   g.CPLAchievedCount,
			CPLTotalCount:      g.CPLTotalCount,
			CPLAchievementRate: g.CPLAchievementRate,
		})
	}

	var classAverageFinalScore float64
	var academicPassRate float64
	var overallCPLPassRate float64

	if totalStudentsAssessed > 0 {
		classAverageFinalScore = math.Round((sumFinalScores/float64(totalStudentsAssessed))*100) / 100
		academicPassRate = math.Round((float64(academicPassCount)/float64(totalStudentsAssessed))*10000) / 100
	} else {
		highestFinalScore = 0
		lowestFinalScore = 0
	}

	if totalCPLAssessedGlobal > 0 {
		overallCPLPassRate = math.Round((float64(totalCPLAchievedGlobal)/float64(totalCPLAssessedGlobal))*10000) / 100
	}

	c.JSON(http.StatusOK, gin.H{
		"course":                     course,
		"total_students_assessed":    totalStudentsAssessed,
		"cpl_columns":                course.CPLs,
		"assessment_items":           assessmentItems,
		"student_matrix":             studentMatrix,
		"cpl_recap":                  recapList,
		"evaluation_cqi":             evaluationItems,
		"grade_distribution":         gradeDistribution,
		"class_average_final_score":  classAverageFinalScore,
		"academic_pass_rate":         academicPassRate,
		"academic_pass_count":        academicPassCount,
		"highest_student":            highestStudentName,
		"highest_score":              highestFinalScore,
		"lowest_student":             lowestStudentName,
		"lowest_score":               lowestFinalScore,
		"overall_cpl_rate":           overallCPLPassRate,
		"total_cpl_assessed_global":  totalCPLAssessedGlobal,
		"total_cpl_achieved_global":  totalCPLAchievedGlobal,
	})
}

// SimulateOBE menghasilkan data simulasi 5 mahasiswa dengan kasus uji bervariasi sesuai aturan OBE
func (cc *CPLController) SimulateOBE(c *gin.Context) {
	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	var course models.Course
	if err := config.DB.First(&course, courseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mata kuliah tidak ditemukan"})
		return
	}

	// 1. Pastikan minimal ada 4 CPL pada mata kuliah
	cpls, err := ensureCourseCPLs(uint(courseID))
	if err != nil || len(cpls) < 3 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan CPL untuk simulasi"})
		return
	}

	var cpl02, cpl03, cpl04, cpl05 models.CourseCPL
	for _, cp := range cpls {
		switch cp.Code {
		case "CPL-02", "CPL-2":
			cpl02 = cp
		case "CPL-03", "CPL-3":
			cpl03 = cp
		case "CPL-04", "CPL-4":
			cpl04 = cp
		case "CPL-05", "CPL-5":
			cpl05 = cp
		}
	}
	if cpl02.ID == 0 {
		cpl02 = cpls[0]
	}
	if cpl03.ID == 0 {
		cpl03 = cpls[1%len(cpls)]
	}
	if cpl04.ID == 0 {
		cpl04 = cpls[2%len(cpls)]
	}
	if cpl05.ID == 0 {
		cpl05 = cpls[3%len(cpls)]
	}

	// 2. Data 5 Mahasiswa Simulasi Persis Sesuai Kasus Uji OBE Pengguna:
	// - Tugas: CPL-03, Bobot 20%
	// - Kuis: CPL-02, Bobot 15%
	// - UTS: CPL-04, Bobot 25%
	// - UAS Bagian A: CPL-04, Bobot 20%
	// - UAS Bagian B: CPL-05, Bobot 20%
	// Total Bobot Instrumen = 100%
	// Total Bobot CPL: CPL-02 (15%), CPL-03 (20%), CPL-04 (45%), CPL-05 (20%) -> Total = 100%
	simulatedStudentsData := []struct {
		NIM   string
		Name  string
		Case  string
		Tugas float64 // CPL-03, 20%
		Kuis  float64 // CPL-02, 15%
		UTS   float64 // CPL-04, 25%
		UAS_A float64 // CPL-04, 20%
		UAS_B float64 // CPL-05, 20%
	}{
		{
			NIM:   "2401001",
			Name:  "Mhs 1 - Ahmad Fauzan",
			Case:  "Kasus 1: Seluruh CPL Tercapai (100%), Nilai Akhir Sangat Baik",
			Tugas: 85.0, // CPL-03 = 85
			Kuis:  80.0, // CPL-02 = 80
			UTS:   75.0, // CPL-04 = (75+80)/2 = 77.5
			UAS_A: 80.0,
			UAS_B: 90.0, // CPL-05 = 90
		},
		{
			NIM:   "2401002",
			Name:  "Mhs 2 - Budi Pratama",
			Case:  "Kasus 2: 3 dari 4 CPL Tercapai (75%), CPL-03 Gagal < 70",
			Tugas: 65.0, // CPL-03 = 65 (Belum Tercapai)
			Kuis:  75.0, // CPL-02 = 75
			UTS:   80.0, // CPL-04 = (80+80)/2 = 80
			UAS_A: 80.0,
			UAS_B: 85.0, // CPL-05 = 85
		},
		{
			NIM:   "2401003",
			Name:  "Mhs 3 - Citra Lestari",
			Case:  "Kasus 3: Seluruh CPL Tercapai (100%), Penguasaan Kuis Tinggi",
			Tugas: 80.0, // CPL-03 = 80
			Kuis:  90.0, // CPL-02 = 90
			UTS:   85.0, // CPL-04 = (85+85)/2 = 85
			UAS_A: 85.0,
			UAS_B: 75.0, // CPL-05 = 75
		},
		{
			NIM:   "2401004",
			Name:  "Mhs 4 - Doni Saputra",
			Case:  "Kasus 4: 2 dari 4 CPL Tercapai (50%), CPL-02 & CPL-04 Perlu Remedial",
			Tugas: 75.0, // CPL-03 = 75
			Kuis:  60.0, // CPL-02 = 60 (Belum Tercapai)
			UTS:   65.0, // CPL-04 = (65+65)/2 = 65 (Belum Tercapai)
			UAS_A: 65.0,
			UAS_B: 80.0, // CPL-05 = 80
		},
		{
			NIM:   "2401005",
			Name:  "Mhs 5 - Eka Rahmawati",
			Case:  "Kasus 5: Prestasi Unggul (Seluruh CPL Tercapai Tinggi, Grade A)",
			Tugas: 90.0, // CPL-03 = 90
			Kuis:  85.0, // CPL-02 = 85
			UTS:   90.0, // CPL-04 = (90+90)/2 = 90
			UAS_A: 90.0,
			UAS_B: 95.0, // CPL-05 = 95
		},
	}

	createdCount := 0

	for _, sData := range simulatedStudentsData {
		var student models.Student
		err := config.DB.Where("nim = ?", sData.NIM).First(&student).Error
		if err != nil {
			student = models.Student{
				NIM:   sData.NIM,
				Name:  sData.Name,
				Major: "Teknik Informatika",
			}
			if err := config.DB.Create(&student).Error; err != nil {
				continue
			}
		}

		compScores := []services.ComponentScore{
			{Name: "Tugas", Category: "tugas", Score: sData.Tugas, Weight: 0.20, CPLID: cpl03.ID, CPLCode: cpl03.Code, CPLDesc: cpl03.Description, TargetScore: cpl03.TargetScore},
			{Name: "Kuis", Category: "kuis", Score: sData.Kuis, Weight: 0.15, CPLID: cpl02.ID, CPLCode: cpl02.Code, CPLDesc: cpl02.Description, TargetScore: cpl02.TargetScore},
			{Name: "UTS", Category: "uts", Score: sData.UTS, Weight: 0.25, CPLID: cpl04.ID, CPLCode: cpl04.Code, CPLDesc: cpl04.Description, TargetScore: cpl04.TargetScore},
			{Name: "UAS bagian A", Category: "uas", Score: sData.UAS_A, Weight: 0.20, CPLID: cpl04.ID, CPLCode: cpl04.Code, CPLDesc: cpl04.Description, TargetScore: cpl04.TargetScore},
			{Name: "UAS bagian B", Category: "uas", Score: sData.UAS_B, Weight: 0.20, CPLID: cpl05.ID, CPLCode: cpl05.Code, CPLDesc: cpl05.Description, TargetScore: cpl05.TargetScore},
		}

		calcResult, err := services.CalculateGradeWithCPL(compScores)
		if err != nil {
			continue
		}

		uasAvg := math.Round(((sData.UAS_A*0.20 + sData.UAS_B*0.20) / 0.40)*100) / 100

		var grade models.Grade
		isNew := false
		if err := config.DB.Where("student_id = ? AND course_id = ?", student.ID, course.ID).First(&grade).Error; err != nil {
			isNew = true
			grade = models.Grade{
				StudentID: student.ID,
				CourseID:  course.ID,
			}
		}

		grade.Assignment = sData.Tugas
		grade.AssignmentWeight = 20.0
		grade.AssignmentCPLID = &cpl03.ID

		grade.Quiz = sData.Kuis
		grade.QuizWeight = 15.0
		grade.QuizCPLID = &cpl02.ID

		grade.Midterm = sData.UTS
		grade.MidtermWeight = 25.0
		grade.MidtermCPLID = &cpl04.ID

		grade.FinalExam = uasAvg
		grade.FinalExamWeight = 40.0
		grade.FinalExamCPLID = &cpl04.ID

		grade.FinalScore = calcResult.FinalScore
		grade.LetterGrade = calcResult.LetterGrade
		grade.Predicate = calcResult.Predicate
		grade.CPLAchievedCount = calcResult.CPLAchievedCount
		grade.CPLTotalCount = calcResult.CPLTotalCount
		grade.CPLAchievementRate = calcResult.CPLAchievementRate
		grade.Status = "Lengkap"

		tx := config.DB.Begin()
		if isNew {
			if err := tx.Create(&grade).Error; err != nil {
				tx.Rollback()
				continue
			}
		} else {
			if err := tx.Save(&grade).Error; err != nil {
				tx.Rollback()
				continue
			}
			_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeItem{})
			_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeCPLDetail{})
		}

		for _, comp := range compScores {
			item := models.GradeItem{
				GradeID:     grade.ID,
				Name:        comp.Name,
				Category:    comp.Category,
				Score:       comp.Score,
				Weight:      comp.Weight * 100,
				CourseCPLID: comp.CPLID,
			}
			_ = tx.Create(&item)
		}

		for _, cplRes := range calcResult.CPLResults {
			detail := models.GradeCPLDetail{
				GradeID:     grade.ID,
				CourseCPLID: cplRes.CPLID,
				CPLCode:     cplRes.CPLCode,
				CPLDesc:     cplRes.CPLDesc,
				Score:       cplRes.Score,
				Weight:      cplRes.Weight,
				TargetScore: cplRes.TargetScore,
				Status:      cplRes.Status,
				Components:  cplRes.Components,
			}
			_ = tx.Create(&detail)
		}

		tx.Commit()
		createdCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Simulasi OBE berhasil dijalankan untuk %d mahasiswa pada mata kuliah %s", createdCount, course.Name),
		"count":   createdCount,
	})
}

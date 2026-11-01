package controllers

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/services"
)

// GradeController menangani input nilai, perhitungan OBE berbasis CPL, dan rekap penilaian
type GradeController struct{}

// NewGradeController membuat instance baru GradeController
func NewGradeController() *GradeController {
	return &GradeController{}
}

// GradeItemInput mendefinisikan sub-instrumen penilaian terpisah (terutama jika UAS mengukur beberapa CPL)
type GradeItemInput struct {
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Score       float64 `json:"score"`
	Weight      float64 `json:"weight"` // dalam persen (misal 15.0%)
	CourseCPLID uint    `json:"cpl_id"`
	AltCPLID    uint    `json:"course_cpl_id"`
}

// GradeInput mendefinisikan payload data untuk input/edit nilai berbasis CPL OBE
type GradeInput struct {
	StudentID        uint             `json:"student_id" binding:"required"`
	CourseID         uint             `json:"course_id" binding:"required"`
	
	// Komponen Utama & Bobot
	Assignment       float64          `json:"assignment"`                   // Nilai Tugas (0-100)
	AssignmentWeight float64          `json:"assignment_weight"`            // Bobot Tugas (default 20%)
	AssignmentCPLID  *uint            `json:"assignment_cpl_id"`           // CPL Tugas
	
	Quiz             float64          `json:"quiz"`                         // Nilai Kuis (0-100)
	QuizWeight       float64          `json:"quiz_weight"`                  // Bobot Kuis (default 20%)
	QuizCPLID        *uint            `json:"quiz_cpl_id"`                 // CPL Kuis
	
	Midterm          float64          `json:"midterm"`                      // Nilai UTS (0-100)
	MidtermWeight    float64          `json:"midterm_weight"`               // Bobot UTS (default 25%)
	MidtermCPLID     *uint            `json:"midterm_cpl_id"`              // CPL UTS
	
	FinalExam        float64          `json:"final_exam"`                   // Nilai UAS (0-100)
	FinalExamWeight  float64          `json:"final_exam_weight"`            // Bobot UAS (default 35%)
	FinalExamCPLID   *uint            `json:"final_exam_cpl_id"`           // CPL UAS
	
	// Sub-instrumen terpisah (opsional jika UAS dipecah menjadi beberapa CPL)
	Items            []GradeItemInput `json:"items"`
}

// BatchGradeStudentInput mendefinisikan input nilai serentak untuk satu mahasiswa
type BatchGradeStudentInput struct {
	StudentID uint             `json:"student_id" binding:"required"`
	Items     []GradeItemInput `json:"items" binding:"required"`
}

// BatchGradePayload mendefinisikan request payload untuk input serentak
type BatchGradePayload struct {
	Grades []BatchGradeStudentInput `json:"grades" binding:"required"`
}

// CourseAssessmentItemInput mendefinisikan payload penyimpanan rancangan butir asesmen MK
type CourseAssessmentItemInput struct {
	ID          uint    `json:"id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Weight      float64 `json:"weight"`
	CourseCPLID uint    `json:"cpl_id"`
	AltCPLID    uint    `json:"course_cpl_id"`
}

// UpdateCourseAssessmentItemsPayload mendefinisikan request update butir asesmen
type UpdateCourseAssessmentItemsPayload struct {
	Items []CourseAssessmentItemInput `json:"items"`
}

// ensureCourseAssessmentItems memastikan mata kuliah memiliki rancangan butir asesmen
func ensureCourseAssessmentItems(courseID uint) ([]models.CourseAssessmentItem, error) {
	if config.DB == nil {
		return nil, fmt.Errorf("koneksi database belum tersedia")
	}

	var items []models.CourseAssessmentItem
	config.DB.Preload("CourseCPL").Where("course_id = ?", courseID).Order("order_index ASC, id ASC").Find(&items)
	if len(items) > 0 {
		return items, nil
	}

	cpls, err := ensureCourseCPLs(courseID)
	if err != nil || len(cpls) == 0 {
		return nil, fmt.Errorf("gagal menyiapkan CPL mata kuliah")
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

	defaults := []models.CourseAssessmentItem{
		{CourseID: courseID, Name: "Tugas", Category: "tugas", Weight: 20.0, CourseCPLID: cpl03.ID, OrderIndex: 1},
		{CourseID: courseID, Name: "Kuis", Category: "kuis", Weight: 15.0, CourseCPLID: cpl02.ID, OrderIndex: 2},
		{CourseID: courseID, Name: "UTS", Category: "uts", Weight: 25.0, CourseCPLID: cpl04.ID, OrderIndex: 3},
		{CourseID: courseID, Name: "UAS bagian A", Category: "uas", Weight: 20.0, CourseCPLID: cpl04.ID, OrderIndex: 4},
		{CourseID: courseID, Name: "UAS bagian B", Category: "uas", Weight: 20.0, CourseCPLID: cpl05.ID, OrderIndex: 5},
	}
	for i := range defaults {
		_ = config.DB.Create(&defaults[i])
	}
	config.DB.Preload("CourseCPL").Where("course_id = ?", courseID).Order("order_index ASC, id ASC").Find(&items)
	return items, nil
}

// ensureCourseCPLs memastikan mata kuliah memiliki CPL dengan target standar 70
func ensureCourseCPLs(courseID uint) ([]models.CourseCPL, error) {
	if config.DB == nil {
		return nil, fmt.Errorf("koneksi database belum tersedia")
	}

	var cpls []models.CourseCPL
	config.DB.Where("course_id = ?", courseID).Order("code ASC, id ASC").Find(&cpls)
	if len(cpls) > 0 {
		return cpls, nil
	}

	defaults := []models.CourseCPL{
		{CourseID: courseID, Code: "CPL-02", Description: "Keterampilan analisis permasalahan dan penerapan metodologi", TargetScore: services.DefaultCPLTargetScore},
		{CourseID: courseID, Code: "CPL-03", Description: "Penguasaan konsep teoritis dasar dan prinsip keilmuan", TargetScore: services.DefaultCPLTargetScore},
		{CourseID: courseID, Code: "CPL-04", Description: "Kemampuan merancang, mengimplementasikan, dan mengevaluasi solusi teknik", TargetScore: services.DefaultCPLTargetScore},
		{CourseID: courseID, Code: "CPL-05", Description: "Kemampuan evaluasi, inovasi, etika profesi, dan penjaminan mutu", TargetScore: services.DefaultCPLTargetScore},
	}
	for i := range defaults {
		_ = config.DB.Create(&defaults[i])
	}
	config.DB.Where("course_id = ?", courseID).Order("code ASC, id ASC").Find(&cpls)
	return cpls, nil
}

// findCPLByID mencari CPL berdasarkan ID atau mengembalikan CPL fallback
func findCPLByID(cpls []models.CourseCPL, targetID *uint, fallbackIndex int) models.CourseCPL {
	if targetID != nil && *targetID > 0 {
		for _, c := range cpls {
			if c.ID == *targetID {
				return c
			}
		}
	}
	if len(cpls) == 0 {
		return models.CourseCPL{Code: "CPL-1", Description: "Capaian Pembelajaran Umum", TargetScore: services.DefaultCPLTargetScore}
	}
	if fallbackIndex >= len(cpls) {
		fallbackIndex = len(cpls) - 1
	}
	return cpls[fallbackIndex]
}

// GetGrades mengambil daftar nilai dengan filter pencarian dan pembatasan role
func (gc *GradeController) GetGrades(c *gin.Context) {
	role := c.GetString("role")
	userID := c.GetUint("userID")

	query := config.DB.Model(&models.Grade{}).
		Preload("Student").
		Preload("Course").
		Preload("AssignmentCPL").
		Preload("QuizCPL").
		Preload("MidtermCPL").
		Preload("FinalExamCPL").
		Preload("Items").
		Preload("CPLDetails")

	// Pembatasan akses: Mahasiswa HANYA dapat melihat nilainya sendiri
	if role == models.RoleMahasiswa {
		var student models.Student
		if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"data": []models.Grade{}, "total": 0})
			return
		}
		query = query.Where("student_id = ?", student.ID)
	} else {
		search := strings.TrimSpace(c.Query("search"))
		courseIDStr := strings.TrimSpace(c.Query("course_id"))
		letterGrade := strings.ToUpper(strings.TrimSpace(c.Query("letter_grade")))

		if search != "" {
			searchPattern := "%" + search + "%"
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

// GetGradeByID mengambil detail satu penilaian dengan rincian instrumen dan CPL
func (gc *GradeController) GetGradeByID(c *gin.Context) {
	id := c.Param("id")
	role := c.GetString("role")
	userID := c.GetUint("userID")

	var grade models.Grade
	if err := config.DB.
		Preload("Student").
		Preload("Course").
		Preload("AssignmentCPL").
		Preload("QuizCPL").
		Preload("MidtermCPL").
		Preload("FinalExamCPL").
		Preload("Items").
		Preload("CPLDetails").
		First(&grade, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penilaian tidak ditemukan"})
		return
	}

	if role == models.RoleMahasiswa {
		var student models.Student
		if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil || grade.StudentID != student.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak: Anda hanya dapat melihat nilai milik Anda sendiri"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": grade})
}

// buildComponentScores merangkai daftar ComponentScore dari payload input
func buildComponentScores(input *GradeInput, cpls []models.CourseCPL) ([]services.ComponentScore, []models.GradeItem) {
	// Bobot default jika tidak ditentukan
	assignW := input.AssignmentWeight
	if assignW <= 0 {
		assignW = 20.0
	}
	quizW := input.QuizWeight
	if quizW <= 0 {
		quizW = 20.0
	}
	midtermW := input.MidtermWeight
	if midtermW <= 0 {
		midtermW = 25.0
	}
	finalW := input.FinalExamWeight
	if finalW <= 0 {
		finalW = 35.0
	}

	assignCPL := findCPLByID(cpls, input.AssignmentCPLID, 0)
	quizCPL := findCPLByID(cpls, input.QuizCPLID, 1%len(cpls))
	midtermCPL := findCPLByID(cpls, input.MidtermCPLID, 2%len(cpls))
	finalExamCPL := findCPLByID(cpls, input.FinalExamCPLID, 3%len(cpls))

	compScores := make([]services.ComponentScore, 0)
	gradeItems := make([]models.GradeItem, 0)

	// Jika ada custom items (misal UAS dipecah menjadi beberapa subnilai CPL)
	if len(input.Items) > 0 {
		for _, it := range input.Items {
			cplID := it.CourseCPLID
			if cplID == 0 {
				cplID = it.AltCPLID
			}
			cpl := findCPLByID(cpls, &cplID, 0)
			compScores = append(compScores, services.ComponentScore{
				Name:        it.Name,
				Category:    it.Category,
				Score:       it.Score,
				Weight:      it.Weight / 100.0,
				CPLID:       cpl.ID,
				CPLCode:     cpl.Code,
				CPLDesc:     cpl.Description,
				TargetScore: cpl.TargetScore,
			})
			gradeItems = append(gradeItems, models.GradeItem{
				Name:        it.Name,
				Category:    it.Category,
				Score:       it.Score,
				Weight:      it.Weight,
				CourseCPLID: cpl.ID,
			})
		}
	} else {
		// Gunakan 4 instrumen standar
		compScores = append(compScores,
			services.ComponentScore{Name: "Tugas", Category: "tugas", Score: input.Assignment, Weight: assignW / 100.0, CPLID: assignCPL.ID, CPLCode: assignCPL.Code, CPLDesc: assignCPL.Description, TargetScore: assignCPL.TargetScore},
			services.ComponentScore{Name: "Kuis", Category: "kuis", Score: input.Quiz, Weight: quizW / 100.0, CPLID: quizCPL.ID, CPLCode: quizCPL.Code, CPLDesc: quizCPL.Description, TargetScore: quizCPL.TargetScore},
			services.ComponentScore{Name: "UTS", Category: "uts", Score: input.Midterm, Weight: midtermW / 100.0, CPLID: midtermCPL.ID, CPLCode: midtermCPL.Code, CPLDesc: midtermCPL.Description, TargetScore: midtermCPL.TargetScore},
			services.ComponentScore{Name: "UAS", Category: "uas", Score: input.FinalExam, Weight: finalW / 100.0, CPLID: finalExamCPL.ID, CPLCode: finalExamCPL.Code, CPLDesc: finalExamCPL.Description, TargetScore: finalExamCPL.TargetScore},
		)

		gradeItems = append(gradeItems,
			models.GradeItem{Name: "Tugas", Category: "tugas", Score: input.Assignment, Weight: assignW, CourseCPLID: assignCPL.ID},
			models.GradeItem{Name: "Kuis", Category: "kuis", Score: input.Quiz, Weight: quizW, CourseCPLID: quizCPL.ID},
			models.GradeItem{Name: "UTS", Category: "uts", Score: input.Midterm, Weight: midtermW, CourseCPLID: midtermCPL.ID},
			models.GradeItem{Name: "UAS", Category: "uas", Score: input.FinalExam, Weight: finalW, CourseCPLID: finalExamCPL.ID},
		)
	}

	return compScores, gradeItems
}

// CreateGrade menginput nilai mahasiswa dan menghitung evaluasi CPL serta nilai akhir (Dosen/Admin)
func (gc *GradeController) CreateGrade(c *gin.Context) {
	var input GradeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Input data tidak valid: " + err.Error()})
		return
	}

	var student models.Student
	if err := config.DB.First(&student, input.StudentID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mahasiswa tidak ditemukan"})
		return
	}

	var course models.Course
	if err := config.DB.First(&course, input.CourseID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mata kuliah tidak ditemukan"})
		return
	}

	var existing models.Grade
	if err := config.DB.Where("student_id = ? AND course_id = ?", input.StudentID, input.CourseID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Nilai untuk mahasiswa pada mata kuliah ini sudah pernah diinput. Silakan perbarui nilai melalui menu edit.",
		})
		return
	}

	cpls, err := ensureCourseCPLs(input.CourseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan CPL mata kuliah: " + err.Error()})
		return
	}

	compScores, gradeItems := buildComponentScores(&input, cpls)

	calcResult, err := services.CalculateGradeWithCPL(compScores)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignCPL := findCPLByID(cpls, input.AssignmentCPLID, 0)
	quizCPL := findCPLByID(cpls, input.QuizCPLID, 1%len(cpls))
	midtermCPL := findCPLByID(cpls, input.MidtermCPLID, 2%len(cpls))
	finalExamCPL := findCPLByID(cpls, input.FinalExamCPLID, 3%len(cpls))

	assignW := input.AssignmentWeight
	if assignW <= 0 {
		assignW = 20.0
	}
	quizW := input.QuizWeight
	if quizW <= 0 {
		quizW = 20.0
	}
	midtermW := input.MidtermWeight
	if midtermW <= 0 {
		midtermW = 25.0
	}
	finalW := input.FinalExamWeight
	if finalW <= 0 {
		finalW = 35.0
	}

	assignScore := input.Assignment
	quizScore := input.Quiz
	midtermScore := input.Midterm
	finalScore := input.FinalExam

	// Jika input menyediakan daftar instrumen dinamis (multiple tugas, kuis, UTS, UAS):
	if len(input.Items) > 0 {
		var aSum, aWeight, qSum, qWeight, mSum, mWeight, fSum, fWeight float64
		for _, it := range input.Items {
			switch strings.ToLower(it.Category) {
			case "tugas":
				aSum += (it.Score * it.Weight)
				aWeight += it.Weight
			case "kuis":
				qSum += (it.Score * it.Weight)
				qWeight += it.Weight
			case "uts":
				mSum += (it.Score * it.Weight)
				mWeight += it.Weight
			case "uas":
				fSum += (it.Score * it.Weight)
				fWeight += it.Weight
			}
		}

		if aWeight > 0 {
			assignScore = math.Round((aSum/aWeight)*100) / 100
			assignW = aWeight
		}
		if qWeight > 0 {
			quizScore = math.Round((qSum/qWeight)*100) / 100
			quizW = qWeight
		}
		if mWeight > 0 {
			midtermScore = math.Round((mSum/mWeight)*100) / 100
			midtermW = mWeight
		}
		if fWeight > 0 {
			finalScore = math.Round((fSum/fWeight)*100) / 100
			finalW = fWeight
		}
	}

	grade := models.Grade{
		StudentID:          input.StudentID,
		CourseID:           input.CourseID,
		Assignment:         assignScore,
		AssignmentWeight:   assignW,
		AssignmentCPLID:    &assignCPL.ID,
		Quiz:               quizScore,
		QuizWeight:         quizW,
		QuizCPLID:          &quizCPL.ID,
		Midterm:            midtermScore,
		MidtermWeight:      midtermW,
		MidtermCPLID:       &midtermCPL.ID,
		FinalExam:          finalScore,
		FinalExamWeight:    finalW,
		FinalExamCPLID:     &finalExamCPL.ID,
		FinalScore:         calcResult.FinalScore,
		LetterGrade:        calcResult.LetterGrade,
		Predicate:          calcResult.Predicate,
		CPLAchievedCount:   calcResult.CPLAchievedCount,
		CPLTotalCount:      calcResult.CPLTotalCount,
		CPLAchievementRate: calcResult.CPLAchievementRate,
		Status:             "Lengkap",
	}

	tx := config.DB.Begin()
	if err := tx.Create(&grade).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data nilai: " + err.Error()})
		return
	}

	for _, it := range gradeItems {
		it.GradeID = grade.ID
		if err := tx.Create(&it).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan instrumen nilai"})
			return
		}
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
		if err := tx.Create(&detail).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan rincian CPL: " + err.Error()})
			return
		}
	}
	tx.Commit()

	_ = config.DB.
		Preload("Student").
		Preload("Course").
		Preload("AssignmentCPL").
		Preload("QuizCPL").
		Preload("MidtermCPL").
		Preload("FinalExamCPL").
		Preload("Items").
		Preload("CPLDetails").
		First(&grade, grade.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Penilaian OBE berhasil dihitung dan disimpan",
		"data":    grade,
	})
}

// UpdateGrade memperbarui nilai dan menghitung ulang ketercapaian CPL serta nilai akhir (Dosen/Admin)
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

	cpls, err := ensureCourseCPLs(grade.CourseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan CPL mata kuliah: " + err.Error()})
		return
	}

	compScores, gradeItems := buildComponentScores(&input, cpls)

	calcResult, err := services.CalculateGradeWithCPL(compScores)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignCPL := findCPLByID(cpls, input.AssignmentCPLID, 0)
	quizCPL := findCPLByID(cpls, input.QuizCPLID, 1%len(cpls))
	midtermCPL := findCPLByID(cpls, input.MidtermCPLID, 2%len(cpls))
	finalExamCPL := findCPLByID(cpls, input.FinalExamCPLID, 3%len(cpls))

	assignW := input.AssignmentWeight
	if assignW <= 0 {
		assignW = 20.0
	}
	quizW := input.QuizWeight
	if quizW <= 0 {
		quizW = 20.0
	}
	midtermW := input.MidtermWeight
	if midtermW <= 0 {
		midtermW = 25.0
	}
	finalW := input.FinalExamWeight
	if finalW <= 0 {
		finalW = 35.0
	}

	assignScore := input.Assignment
	quizScore := input.Quiz
	midtermScore := input.Midterm
	finalScore := input.FinalExam

	if len(input.Items) > 0 {
		var aSum, aWeight, qSum, qWeight, mSum, mWeight, fSum, fWeight float64
		for _, it := range input.Items {
			switch strings.ToLower(it.Category) {
			case "tugas":
				aSum += (it.Score * it.Weight)
				aWeight += it.Weight
			case "kuis":
				qSum += (it.Score * it.Weight)
				qWeight += it.Weight
			case "uts":
				mSum += (it.Score * it.Weight)
				mWeight += it.Weight
			case "uas":
				fSum += (it.Score * it.Weight)
				fWeight += it.Weight
			}
		}

		if aWeight > 0 {
			assignScore = math.Round((aSum/aWeight)*100) / 100
			assignW = aWeight
		}
		if qWeight > 0 {
			quizScore = math.Round((qSum/qWeight)*100) / 100
			quizW = qWeight
		}
		if mWeight > 0 {
			midtermScore = math.Round((mSum/mWeight)*100) / 100
			midtermW = mWeight
		}
		if fWeight > 0 {
			finalScore = math.Round((fSum/fWeight)*100) / 100
			finalW = fWeight
		}
	}

	grade.Assignment = assignScore
	grade.AssignmentWeight = assignW
	grade.AssignmentCPLID = &assignCPL.ID

	grade.Quiz = quizScore
	grade.QuizWeight = quizW
	grade.QuizCPLID = &quizCPL.ID

	grade.Midterm = midtermScore
	grade.MidtermWeight = midtermW
	grade.MidtermCPLID = &midtermCPL.ID

	grade.FinalExam = finalScore
	grade.FinalExamWeight = finalW
	grade.FinalExamCPLID = &finalExamCPL.ID

	grade.FinalScore = calcResult.FinalScore
	grade.LetterGrade = calcResult.LetterGrade
	grade.Predicate = calcResult.Predicate
	grade.CPLAchievedCount = calcResult.CPLAchievedCount
	grade.CPLTotalCount = calcResult.CPLTotalCount
	grade.CPLAchievementRate = calcResult.CPLAchievementRate
	grade.Status = "Lengkap"

	tx := config.DB.Begin()
	if err := tx.Save(&grade).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data penilaian: " + err.Error()})
		return
	}

	_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeItem{})
	_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeCPLDetail{})

	for _, it := range gradeItems {
		it.GradeID = grade.ID
		_ = tx.Create(&it)
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

	_ = config.DB.
		Preload("Student").
		Preload("Course").
		Preload("AssignmentCPL").
		Preload("QuizCPL").
		Preload("MidtermCPL").
		Preload("FinalExamCPL").
		Preload("Items").
		Preload("CPLDetails").
		First(&grade, grade.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Data nilai berhasil diperbarui dan dihitung ulang berdasarkan aturan OBE",
		"data":    grade,
	})
}

// DeleteGrade menghapus data penilaian beserta sub-item dan rincian CPL
func (gc *GradeController) DeleteGrade(c *gin.Context) {
	id := c.Param("id")

	var grade models.Grade
	if err := config.DB.First(&grade, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data penilaian tidak ditemukan"})
		return
	}

	tx := config.DB.Begin()
	_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeItem{})
	_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeCPLDetail{})
	if err := tx.Delete(&grade).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data penilaian"})
		return
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Data penilaian ID %s berhasil dihapus", id),
	})
}

// GetCourseAssessmentItems mengambil rancangan butir asesmen pada suatu mata kuliah
func (gc *GradeController) GetCourseAssessmentItems(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[PANIC in GetCourseAssessmentItems]: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Terjadi kesalahan internal: %v", r)})
		}
	}()

	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Koneksi database belum terhubung. Pastikan internet dan database aktif."})
		return
	}

	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	items, err := ensureCourseAssessmentItems(uint(courseID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat butir asesmen: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": items,
	})
}

// UpdateCourseAssessmentItems memperbarui seluruh rancangan butir penilaian mata kuliah
func (gc *GradeController) UpdateCourseAssessmentItems(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[PANIC in UpdateCourseAssessmentItems]: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Terjadi kesalahan internal server: %v", r)})
		}
	}()

	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Koneksi database belum terhubung. Pastikan internet dan database aktif."})
		return
	}

	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	var course models.Course
	if err := config.DB.First(&course, courseID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mata kuliah tidak ditemukan di database"})
		return
	}

	var payload UpdateCourseAssessmentItemsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data butir penilaian tidak valid: " + err.Error()})
		return
	}

	if len(payload.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimal harus ada 1 butir penilaian"})
		return
	}

	totalWeight := 0.0
	for _, it := range payload.Items {
		totalWeight += it.Weight
	}
	if math.Abs(totalWeight-100.0) > 0.1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Total bobot seluruh butir penilaian harus tepat 100%%, saat ini: %.1f%%", totalWeight)})
		return
	}

	cpls, err := ensureCourseCPLs(uint(courseID))
	if err != nil || len(cpls) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan CPL mata kuliah"})
		return
	}

	cplMap := make(map[uint]bool)
	for _, cp := range cpls {
		cplMap[cp.ID] = true
	}

	tx := config.DB.Begin()
	if err := tx.Unscoped().Where("course_id = ?", uint(courseID)).Delete(&models.CourseAssessmentItem{}).Error; err != nil {
		tx.Rollback()
		log.Printf("[ERROR] Gagal menghapus butir asesmen lama untuk course %d: %v", courseID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui butir penilaian: " + err.Error()})
		return
	}

	for idx, it := range payload.Items {
		cplID := it.CourseCPLID
		if cplID == 0 {
			cplID = it.AltCPLID
		}
		// Jika cplID tidak ada di daftar CPL mata kuliah ini, fallback ke cpls[0].ID
		if !cplMap[cplID] {
			cplID = cpls[0].ID
		}

		name := strings.TrimSpace(it.Name)
		if name == "" {
			name = fmt.Sprintf("Butir %d", idx+1)
		}

		category := strings.ToLower(strings.TrimSpace(it.Category))
		if category == "" {
			category = "tugas"
		}

		newItem := models.CourseAssessmentItem{
			CourseID:    uint(courseID),
			Name:        name,
			Category:    category,
			Weight:      it.Weight,
			CourseCPLID: cplID,
			OrderIndex:  idx + 1,
		}
		if err := tx.Create(&newItem).Error; err != nil {
			tx.Rollback()
			log.Printf("[ERROR] Gagal membuat butir penilaian (CourseID: %d, Name: %s, CPL: %d): %v", courseID, name, cplID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan butir penilaian: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		log.Printf("[ERROR] Gagal commit transaksi butir asesmen: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan penyimpanan: " + err.Error()})
		return
	}

	var updatedItems []models.CourseAssessmentItem
	config.DB.Preload("CourseCPL").Where("course_id = ?", uint(courseID)).Order("order_index ASC, id ASC").Find(&updatedItems)

	c.JSON(http.StatusOK, gin.H{
		"message": "Rancangan butir penilaian mata kuliah berhasil diperbarui",
		"data":    updatedItems,
	})
}

// SaveBatchGrades menyimpan penilaian serentak untuk seluruh mahasiswa di kelas
func (gc *GradeController) SaveBatchGrades(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[PANIC in SaveBatchGrades]: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Terjadi kesalahan internal saat simpan batch: %v", r)})
		}
	}()

	if config.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Koneksi database belum terhubung. Pastikan internet dan database aktif."})
		return
	}

	courseIDStr := c.Param("id")
	courseID, err := strconv.ParseUint(courseIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata kuliah tidak valid"})
		return
	}

	var payload BatchGradePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data penilaian serentak tidak valid: " + err.Error()})
		return
	}

	cpls, err := ensureCourseCPLs(uint(courseID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan CPL: " + err.Error()})
		return
	}

	tx := config.DB.Begin()
	savedCount := 0

	for _, sGrade := range payload.Grades {
		if sGrade.StudentID == 0 || len(sGrade.Items) == 0 {
			continue
		}

		compScores := make([]services.ComponentScore, 0, len(sGrade.Items))
		gradeItems := make([]models.GradeItem, 0, len(sGrade.Items))

		var aSum, aWeight, qSum, qWeight, mSum, mWeight, fSum, fWeight float64
		var aCpl, qCpl, mCpl, fCpl *uint

		for _, it := range sGrade.Items {
			cplID := it.CourseCPLID
			if cplID == 0 {
				cplID = it.AltCPLID
			}
			cpl := findCPLByID(cpls, &cplID, 0)
			compScores = append(compScores, services.ComponentScore{
				Name:        it.Name,
				Category:    it.Category,
				Score:       it.Score,
				Weight:      it.Weight / 100.0,
				CPLID:       cpl.ID,
				CPLCode:     cpl.Code,
				CPLDesc:     cpl.Description,
				TargetScore: cpl.TargetScore,
			})
			gradeItems = append(gradeItems, models.GradeItem{
				Name:        it.Name,
				Category:    it.Category,
				Score:       it.Score,
				Weight:      it.Weight,
				CourseCPLID: cpl.ID,
			})

			switch strings.ToLower(it.Category) {
			case "tugas":
				aSum += (it.Score * it.Weight)
				aWeight += it.Weight
				if aCpl == nil {
					aCpl = &cpl.ID
				}
			case "kuis":
				qSum += (it.Score * it.Weight)
				qWeight += it.Weight
				if qCpl == nil {
					qCpl = &cpl.ID
				}
			case "uts":
				mSum += (it.Score * it.Weight)
				mWeight += it.Weight
				if mCpl == nil {
					mCpl = &cpl.ID
				}
			case "uas":
				fSum += (it.Score * it.Weight)
				fWeight += it.Weight
				if fCpl == nil {
					fCpl = &cpl.ID
				}
			}
		}

		calcResult, err := services.CalculateGradeWithCPL(compScores)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Kalkulasi gagal untuk mahasiswa ID %d: %s", sGrade.StudentID, err.Error())})
			return
		}

		assignScore := 0.0
		if aWeight > 0 {
			assignScore = math.Round((aSum/aWeight)*100) / 100
		}
		quizScore := 0.0
		if qWeight > 0 {
			quizScore = math.Round((qSum/qWeight)*100) / 100
		}
		midtermScore := 0.0
		if mWeight > 0 {
			midtermScore = math.Round((mSum/mWeight)*100) / 100
		}
		finalScore := 0.0
		if fWeight > 0 {
			finalScore = math.Round((fSum/fWeight)*100) / 100
		}

		var grade models.Grade
		isNew := false
		if err := tx.Where("student_id = ? AND course_id = ?", sGrade.StudentID, uint(courseID)).First(&grade).Error; err != nil {
			isNew = true
			grade = models.Grade{
				StudentID: sGrade.StudentID,
				CourseID:  uint(courseID),
			}
		}

		grade.Assignment = assignScore
		grade.AssignmentWeight = aWeight
		grade.AssignmentCPLID = aCpl

		grade.Quiz = quizScore
		grade.QuizWeight = qWeight
		grade.QuizCPLID = qCpl

		grade.Midterm = midtermScore
		grade.MidtermWeight = mWeight
		grade.MidtermCPLID = mCpl

		grade.FinalExam = finalScore
		grade.FinalExamWeight = fWeight
		grade.FinalExamCPLID = fCpl

		grade.FinalScore = calcResult.FinalScore
		grade.LetterGrade = calcResult.LetterGrade
		grade.Predicate = calcResult.Predicate
		grade.CPLAchievedCount = calcResult.CPLAchievedCount
		grade.CPLTotalCount = calcResult.CPLTotalCount
		grade.CPLAchievementRate = calcResult.CPLAchievementRate
		grade.Status = "Lengkap"

		if isNew {
			if err := tx.Create(&grade).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat nilai mahasiswa: " + err.Error()})
				return
			}
		} else {
			if err := tx.Save(&grade).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui nilai mahasiswa: " + err.Error()})
				return
			}
			_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeItem{})
			_ = tx.Where("grade_id = ?", grade.ID).Delete(&models.GradeCPLDetail{})
		}

		for _, it := range gradeItems {
			it.GradeID = grade.ID
			_ = tx.Create(&it)
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

		savedCount++
	}

	if err := tx.Commit().Error; err != nil {
		log.Printf("[ERROR] Gagal commit transaksi batch: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan ke database: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     fmt.Sprintf("Penilaian serentak berhasil disimpan untuk %d mahasiswa", savedCount),
		"saved_count": savedCount,
	})
}

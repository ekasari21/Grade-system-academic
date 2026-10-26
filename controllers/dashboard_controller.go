package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
)

// DashboardController menangani penyajian statistik dan data ringkasan dashboard
type DashboardController struct{}

// NewDashboardController membuat instance baru DashboardController
func NewDashboardController() *DashboardController {
	return &DashboardController{}
}

// GradeDistribution menampung jumlah sebaran grade huruf
type GradeDistribution struct {
	A  int64 `json:"A"`
	AB int64 `json:"AB"`
	B  int64 `json:"B"`
	BC int64 `json:"BC"`
	C  int64 `json:"C"`
	D  int64 `json:"D"`
	E  int64 `json:"E"`
}

// GetSummary menghitung data statistik ringkasan untuk dashboard
func (dc *DashboardController) GetSummary(c *gin.Context) {
	role := c.GetString("role")
	userID := c.GetUint("userID")

	if role == models.RoleMahasiswa {
		// Ringkasan khusus untuk Mahasiswa
		var student models.Student
		if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{
				"total_courses": 0,
				"average_score": 0.0,
				"distribution":  GradeDistribution{},
			})
			return
		}

		var grades []models.Grade
		config.DB.Where("student_id = ?", student.ID).Find(&grades)

		var totalScore float64
		dist := GradeDistribution{}
		for _, g := range grades {
			totalScore += g.FinalScore
			switch g.LetterGrade {
			case "A":
				dist.A++
			case "AB":
				dist.AB++
			case "B":
				dist.B++
			case "BC":
				dist.BC++
			case "C":
				dist.C++
			case "D":
				dist.D++
			case "E":
				dist.E++
			}
		}

		avgScore := 0.0
		if len(grades) > 0 {
			avgScore = totalScore / float64(len(grades))
		}

		c.JSON(http.StatusOK, gin.H{
			"role":          "mahasiswa",
			"total_courses": len(grades),
			"average_score": avgScore,
			"distribution":  dist,
		})
		return
	}

	// Ringkasan global untuk Dosen dan Admin
	var totalStudents int64
	var totalCourses int64
	var totalGrades int64

	config.DB.Model(&models.Student{}).Count(&totalStudents)
	config.DB.Model(&models.Course{}).Count(&totalCourses)
	config.DB.Model(&models.Grade{}).Count(&totalGrades)

	// Hitung rata-rata nilai akhir
	var avgScore struct {
		Average float64
	}
	config.DB.Model(&models.Grade{}).Select("COALESCE(AVG(final_score), 0) as average").Scan(&avgScore)

	// Hitung sebaran grade huruf
	dist := GradeDistribution{}
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'A'").Count(&dist.A)
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'AB'").Count(&dist.AB)
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'B'").Count(&dist.B)
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'BC'").Count(&dist.BC)
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'C'").Count(&dist.C)
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'D'").Count(&dist.D)
	config.DB.Model(&models.Grade{}).Where("letter_grade = 'E'").Count(&dist.E)

	c.JSON(http.StatusOK, gin.H{
		"role":           role,
		"total_students": totalStudents,
		"total_courses":  totalCourses,
		"total_grades":   totalGrades,
		"average_score":  avgScore.Average,
		"distribution":   dist,
	})
}

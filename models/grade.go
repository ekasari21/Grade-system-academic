package models

import (
	"time"

	"gorm.io/gorm"
)

// Grade merepresentasikan rekaman penilaian mahasiswa pada mata kuliah dengan model OBE berbasis CPL
type Grade struct {
	ID                 uint             `gorm:"primaryKey" json:"id"`
	StudentID          uint             `gorm:"not null;uniqueIndex:idx_student_course" json:"student_id" binding:"required"`
	CourseID           uint             `gorm:"not null;uniqueIndex:idx_student_course" json:"course_id" binding:"required"`
	Student            *Student         `gorm:"foreignKey:StudentID" json:"student,omitempty"`
	Course             *Course          `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	
	// Komponen Utama
	Assignment         float64          `gorm:"type:decimal(5,2);default:0" json:"assignment"` // Nilai Tugas (0-100)
	AssignmentWeight   float64          `gorm:"type:decimal(5,2);default:20" json:"assignment_weight"` // Bobot Tugas (%)
	AssignmentCPLID    *uint            `gorm:"index" json:"assignment_cpl_id,omitempty"`
	AssignmentCPL      *CourseCPL       `gorm:"foreignKey:AssignmentCPLID" json:"assignment_cpl,omitempty"`
	
	Quiz               float64          `gorm:"type:decimal(5,2);default:0" json:"quiz"`       // Nilai Kuis (0-100)
	QuizWeight         float64          `gorm:"type:decimal(5,2);default:20" json:"quiz_weight"` // Bobot Kuis (%)
	QuizCPLID          *uint            `gorm:"index" json:"quiz_cpl_id,omitempty"`
	QuizCPL            *CourseCPL       `gorm:"foreignKey:QuizCPLID" json:"quiz_cpl,omitempty"`
	
	Midterm            float64          `gorm:"type:decimal(5,2);default:0" json:"midterm"`    // Nilai UTS (0-100)
	MidtermWeight      float64          `gorm:"type:decimal(5,2);default:25" json:"midterm_weight"` // Bobot UTS (%)
	MidtermCPLID       *uint            `gorm:"index" json:"midterm_cpl_id,omitempty"`
	MidtermCPL         *CourseCPL       `gorm:"foreignKey:MidtermCPLID" json:"midterm_cpl,omitempty"`
	
	FinalExam          float64          `gorm:"type:decimal(5,2);default:0" json:"final_exam"` // Nilai UAS Komprehensif (0-100)
	FinalExamWeight    float64          `gorm:"type:decimal(5,2);default:35" json:"final_exam_weight"` // Bobot UAS (%)
	FinalExamCPLID     *uint            `gorm:"index" json:"final_exam_cpl_id,omitempty"`
	FinalExamCPL       *CourseCPL       `gorm:"foreignKey:FinalExamCPLID" json:"final_exam_cpl,omitempty"`
	
	// Instrumen / Subnilai terpisah (misal jika UAS mengukur beberapa CPL)
	Items              []GradeItem      `gorm:"foreignKey:GradeID" json:"items,omitempty"`
	
	// Hasil Perhitungan Nilai Akhir (Akumulasi Nilai Komponen x Bobot Komponen)
	FinalScore         float64          `gorm:"type:decimal(5,2);default:0" json:"final_score"`
	LetterGrade        string           `gorm:"type:varchar(5)" json:"letter_grade"`
	Predicate          string           `gorm:"type:varchar(50)" json:"predicate"`
	
	// Pengukuran Ketercapaian CPL Berbasis OBE (Target Minimal 70)
	CPLAchievedCount   int              `gorm:"default:0" json:"cpl_achieved_count"` // Jumlah CPL Tercapai (Nilai >= 70)
	CPLTotalCount      int              `gorm:"default:0" json:"cpl_total_count"`    // Total CPL yang Diukur
	CPLAchievementRate float64          `gorm:"type:decimal(5,2);default:0" json:"cpl_achievement_rate"` // Persentase Ketercapaian CPL (%)
	
	Status             string           `gorm:"type:varchar(20);default:'Lengkap'" json:"status"`
	CPLDetails         []GradeCPLDetail `gorm:"foreignKey:GradeID" json:"cpl_details,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
	DeletedAt          gorm.DeletedAt   `gorm:"index" json:"-"`
}

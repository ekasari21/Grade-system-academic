package models

import (
	"time"

	"gorm.io/gorm"
)

// Grade merepresentasikan rekaman nilai mahasiswa pada mata kuliah tertentu
type Grade struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	StudentID   uint           `gorm:"not null;uniqueIndex:idx_student_course" json:"student_id" binding:"required"`
	CourseID    uint           `gorm:"not null;uniqueIndex:idx_student_course" json:"course_id" binding:"required"`
	Student     *Student       `gorm:"foreignKey:StudentID" json:"student,omitempty"`
	Course      *Course        `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	Assignment  float64        `gorm:"type:decimal(5,2);default:0" json:"assignment"` // Nilai Tugas (Bobot 20%)
	Quiz        float64        `gorm:"type:decimal(5,2);default:0" json:"quiz"`       // Nilai Kuis (Bobot 20%)
	Midterm     float64        `gorm:"type:decimal(5,2);default:0" json:"midterm"`    // Nilai UTS (Bobot 25%)
	FinalExam   float64        `gorm:"type:decimal(5,2);default:0" json:"final_exam"` // Nilai UAS (Bobot 35%)
	FinalScore  float64        `gorm:"type:decimal(5,2);default:0" json:"final_score"`
	LetterGrade string         `gorm:"type:varchar(5)" json:"letter_grade"`
	Predicate   string         `gorm:"type:varchar(50)" json:"predicate"`
	Status      string         `gorm:"type:varchar(20);default:'Lengkap'" json:"status"` // "Lengkap" atau "Belum Lengkap"
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

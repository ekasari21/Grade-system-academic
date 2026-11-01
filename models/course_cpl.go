package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// CourseCPL merepresentasikan Capaian Pembelajaran Lulusan (CPL) pada suatu mata kuliah
type CourseCPL struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	CourseID    uint           `gorm:"not null;index" json:"course_id"`
	Code        string         `gorm:"type:varchar(20);not null" json:"code"`               // Contoh: "CPL-1", "CPL-2"
	Description string         `gorm:"type:text;not null" json:"description"`               // Contoh: "Mampu memahami prinsip algoritma..."
	TargetScore float64        `gorm:"type:decimal(5,2);default:70.00" json:"target_score"` // Target ketercapaian minimal sesuai OBE: 70
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// CourseAssessmentItem merepresentasikan rancangan butir komponen penilaian (RPS) pada suatu mata kuliah
type CourseAssessmentItem struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	CourseID    uint           `gorm:"not null;index" json:"course_id"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"` // Contoh: "Tugas", "Kuis", "UTS", "UAS Bagian A", "UAS Bagian B"
	Category    string         `gorm:"type:varchar(20);not null" json:"category"` // "tugas", "kuis", "uts", "uas"
	Weight      float64        `gorm:"type:decimal(5,2);not null" json:"weight"` // Bobot dalam % (misal: 20.00 untuk 20%)
	CourseCPLID uint           `gorm:"not null;index" json:"cpl_id"`
	CourseCPL   *CourseCPL     `gorm:"foreignKey:CourseCPLID" json:"course_cpl,omitempty"`
	OrderIndex  int            `gorm:"default:0" json:"order_index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// GradeItem merepresentasikan satu instrumen/sub-komponen penilaian (Tugas, Kuis, UTS, UAS / Subnilai UAS)
type GradeItem struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	GradeID     uint       `gorm:"not null;index" json:"grade_id"`
	Name        string     `gorm:"type:varchar(50);not null" json:"name"`                 // Contoh: "Tugas", "Kuis", "UTS", "UAS - Sub 1"
	Category    string     `gorm:"type:varchar(20);not null" json:"category"`             // "tugas", "kuis", "uts", "uas"
	Score       float64    `gorm:"type:decimal(5,2);not null" json:"score"`               // 0 - 100
	Weight      float64    `gorm:"type:decimal(5,2);not null" json:"weight"`              // Bobot dalam persentase (misal: 20.00 untuk 20%)
	CourseCPLID uint       `gorm:"not null;index" json:"cpl_id"`
	CourseCPL   *CourseCPL `gorm:"foreignKey:CourseCPLID" json:"course_cpl,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// GradeCPLDetail menyimpan rekaman hasil evaluasi ketercapaian per CPL untuk mahasiswa
type GradeCPLDetail struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	GradeID     uint       `gorm:"not null;index" json:"grade_id"`
	CourseCPLID uint       `gorm:"not null;index" json:"cpl_id"`
	CourseCPL   *CourseCPL `gorm:"foreignKey:CourseCPLID" json:"course_cpl,omitempty"`
	CPLCode     string     `gorm:"type:varchar(20);not null" json:"cpl_code"`
	CPLDesc     string     `gorm:"type:text;not null" json:"cpl_desc"`
	Score       float64    `gorm:"type:decimal(5,2);default:0" json:"score"`                   // Nilai CPL rata-rata tertimbang (0 - 100)
	Weight      float64    `gorm:"type:decimal(5,2);default:0" json:"weight"`                  // Total bobot komponen yang mengukur CPL ini (%)
	TargetScore float64    `gorm:"type:decimal(5,2);default:70.00" json:"target_score"`        // Target minimal (70)
	Status      string     `gorm:"type:varchar(30);default:'Belum Tercapai'" json:"status"`    // "Tercapai" (>= 70) atau "Belum Tercapai" (< 70)
	Components  string     `gorm:"type:varchar(255)" json:"components"`                        // Daftar komponen pembentuk, misal: "Tugas (20%), Kuis (10%)"
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// MarshalJSON menghasilkan field cpl_id dan course_cpl_id agar kompatibel dengan seluruh komponen UI
func (c CourseAssessmentItem) MarshalJSON() ([]byte, error) {
	type Alias CourseAssessmentItem
	return json.Marshal(&struct {
		Alias
		CPLID       uint `json:"cpl_id"`
		CourseCPLID uint `json:"course_cpl_id"`
	}{
		Alias:       Alias(c),
		CPLID:       c.CourseCPLID,
		CourseCPLID: c.CourseCPLID,
	})
}

// MarshalJSON menghasilkan field cpl_id dan course_cpl_id agar kompatibel dengan seluruh komponen UI
func (g GradeItem) MarshalJSON() ([]byte, error) {
	type Alias GradeItem
	return json.Marshal(&struct {
		Alias
		CPLID       uint `json:"cpl_id"`
		CourseCPLID uint `json:"course_cpl_id"`
	}{
		Alias:       Alias(g),
		CPLID:       g.CourseCPLID,
		CourseCPLID: g.CourseCPLID,
	})
}

// MarshalJSON menghasilkan field cpl_id dan course_cpl_id agar kompatibel dengan seluruh komponen UI
func (d GradeCPLDetail) MarshalJSON() ([]byte, error) {
	type Alias GradeCPLDetail
	return json.Marshal(&struct {
		Alias
		CPLID       uint `json:"cpl_id"`
		CourseCPLID uint `json:"course_cpl_id"`
	}{
		Alias:       Alias(d),
		CPLID:       d.CourseCPLID,
		CourseCPLID: d.CourseCPLID,
	})
}

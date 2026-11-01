package models

import (
	"time"

	"gorm.io/gorm"
)

// Course merepresentasikan data mata kuliah
type Course struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Code      string         `gorm:"type:varchar(20);uniqueIndex;not null" json:"code" binding:"required"`
	Name      string         `gorm:"type:varchar(100);not null" json:"name" binding:"required"`
	Credits         int                    `gorm:"not null" json:"credits" binding:"required,min=1,max=6"`
	CPLs            []CourseCPL            `gorm:"foreignKey:CourseID" json:"cpls,omitempty"`
	AssessmentItems []CourseAssessmentItem `gorm:"foreignKey:CourseID" json:"assessment_items,omitempty"`
	Grades          []Grade                `gorm:"foreignKey:CourseID" json:"grades,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

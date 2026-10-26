package models

import (
	"time"

	"gorm.io/gorm"
)

// Student merepresentasikan data mahasiswa
type Student struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    *uint          `gorm:"index" json:"user_id,omitempty"` // Opsional: relasi ke akun User
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	NIM       string         `gorm:"type:varchar(20);uniqueIndex;not null" json:"nim" binding:"required"`
	Name      string         `gorm:"type:varchar(100);not null" json:"name" binding:"required"`
	Major     string         `gorm:"type:varchar(100);not null" json:"major" binding:"required"`
	Grades    []Grade        `gorm:"foreignKey:StudentID" json:"grades,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

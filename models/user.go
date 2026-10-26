package models

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Role konstanta untuk hak akses pengguna
const (
	RoleAdmin     = "admin"
	RoleDosen     = "dosen"
	RoleMahasiswa = "mahasiswa"
)

// User merepresentasikan tabel akun pengguna di database
type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"type:varchar(100);not null" json:"name" binding:"required"`
	Email     string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"email" binding:"required,email"`
	Password  string         `gorm:"type:varchar(255);not null" json:"-"` // json:"-" agar hash password tidak pernah bocor ke API
	Role      string         `gorm:"type:varchar(20);not null;default:'mahasiswa'" json:"role"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// SetPassword melakukan hashing password menggunakan bcrypt
func (u *User) SetPassword(plainPassword string) error {
	if len(plainPassword) < 6 {
		return errors.New("password minimal harus 6 karakter")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hash)
	return nil
}

// CheckPassword membandingkan plain text password dengan hash yang tersimpan
func (u *User) CheckPassword(plainPassword string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(plainPassword))
	return err == nil
}

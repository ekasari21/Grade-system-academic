package models

import (
	"log"

	"gorm.io/gorm"
)

// AutoMigrate menjalankan migrasi skema tabel untuk semua model ke database
func AutoMigrate(db *gorm.DB) error {
	log.Println("[INFO] Menjalankan migrasi database skema GORM...")
	err := db.AutoMigrate(
		&User{},
		&Student{},
		&Course{},
		&Grade{},
	)
	if err != nil {
		log.Printf("[ERROR] Gagal melakukan migrasi skema: %v", err)
		return err
	}
	log.Println("[SUCCESS] Migrasi skema database berhasil selesai.")
	return nil
}

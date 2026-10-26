package config

import (
	"errors"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB adalah instance global untuk koneksi database GORM
var DB *gorm.DB

// ConnectDatabase membuka koneksi ke PostgreSQL menggunakan DATABASE_URL dari config
func ConnectDatabase(cfg *Config) (*gorm.DB, error) {
	if cfg == nil || cfg.DatabaseURL == "" {
		return nil, errors.New("konfigurasi DATABASE_URL tidak boleh kosong")
	}

	// Gunakan logger GORM level info/warn agar mudah ditelusuri
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), gormConfig)
	if err != nil {
		log.Println("[ERROR] Gagal membuka koneksi ke PostgreSQL. Pastikan server database aktif dan DATABASE_URL benar.")
		return nil, err
	}

	// Pengaturan connection pool standar
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Uji koneksi aktif (ping)
	if err := sqlDB.Ping(); err != nil {
		log.Println("[ERROR] Database tidak merespons (Ping gagal). Pastikan PostgreSQL berjalan.")
		return nil, err
	}

	DB = db
	log.Println("[SUCCESS] Koneksi ke database PostgreSQL berhasil dibuat.")
	return db, nil
}

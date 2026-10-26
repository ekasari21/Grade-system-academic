package main

import (
	"log"

	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/routes"
)

func main() {
	log.Println("[INFO] Memulai Student Grade Calculator API Server...")

	// 1. Memuat konfigurasi dari file .env
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[FATAL] Gagal memuat konfigurasi: %v", err)
	}
	log.Printf("[INFO] Konfigurasi berhasil dimuat. Port: %s", cfg.AppPort)

	// 2. Menghubungkan ke database PostgreSQL
	db, err := config.ConnectDatabase(cfg)
	if err != nil {
		log.Printf("[WARN] Koneksi database belum terhubung: %v", err)
		log.Println("[WARN] Aplikasi tetap berjalan. Pastikan PostgreSQL berjalan dan database telah dibuat.")
	} else {
		// Menjalankan migrasi skema tabel otomatis
		if err := models.AutoMigrate(db); err != nil {
			log.Printf("[ERROR] Gagal migrasi database: %v", err)
		}
	}

	// 3. Menginisialisasi Router dan Rute API
	r := routes.SetupRouter(cfg)

	// 4. Menjalankan server pada port yang dikonfigurasi
	log.Printf("[INFO] Server siap menerima koneksi di http://localhost:%s", cfg.AppPort)
	if err := r.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("[FATAL] Gagal menjalankan server: %v", err)
	}
}

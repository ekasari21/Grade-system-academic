package config

import (
	"errors"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config menampung semua konfigurasi aplikasi yang dibaca dari environment variables.
type Config struct {
	AppPort        string
	DatabaseURL    string
	JWTSecret      string
	JWTExpiresIn   string
	CookieSecure   bool
	CookieSameSite string
}

// LoadConfig memuat file .env (jika ada) dan membaca nilai environment variable.
func LoadConfig() (*Config, error) {
	// Muat file .env jika ada di folder kerja
	if err := godotenv.Load(); err != nil {
		log.Println("[INFO] File .env tidak ditemukan atau menggunakan environment sistem.")
	}

	appPort := os.Getenv("PORT")
	if appPort == "" {
		appPort = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL wajib diatur di file .env atau environment variable")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET wajib diatur di file .env atau environment variable")
	}

	jwtExpiresIn := os.Getenv("JWT_EXPIRES_IN")
	if jwtExpiresIn == "" {
		jwtExpiresIn = "15m"
	}

	cookieSecure := false
	if strings.ToLower(os.Getenv("COOKIE_SECURE")) == "true" {
		cookieSecure = true
	}

	cookieSameSite := os.Getenv("COOKIE_SAME_SITE")
	if cookieSameSite == "" {
		cookieSameSite = "lax"
	}

	return &Config{
		AppPort:        appPort,
		DatabaseURL:    databaseURL,
		JWTSecret:      jwtSecret,
		JWTExpiresIn:   jwtExpiresIn,
		CookieSecure:   cookieSecure,
		CookieSameSite: cookieSameSite,
	}, nil
}

package config

import (
	"os"
	"testing"
)

func TestLoadConfig_Success(t *testing.T) {
	// Setup env tiruan
	os.Setenv("APP_PORT", "9090")
	os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/testdb?sslmode=disable")
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("JWT_EXPIRES_IN", "30m")
	os.Setenv("COOKIE_SECURE", "true")
	os.Setenv("COOKIE_SAME_SITE", "strict")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() mengembalikan error tidak terduga: %v", err)
	}

	if cfg.AppPort != "9090" {
		t.Errorf("AppPort diharapkan 9090, didapat: %s", cfg.AppPort)
	}
	if cfg.DatabaseURL != "postgres://user:pass@localhost:5432/testdb?sslmode=disable" {
		t.Errorf("DatabaseURL tidak cocok")
	}
	if cfg.JWTSecret != "test-secret-key" {
		t.Errorf("JWTSecret tidak cocok")
	}
	if cfg.JWTExpiresIn != "30m" {
		t.Errorf("JWTExpiresIn diharapkan 30m, didapat: %s", cfg.JWTExpiresIn)
	}
	if !cfg.CookieSecure {
		t.Errorf("CookieSecure diharapkan true")
	}
	if cfg.CookieSameSite != "strict" {
		t.Errorf("CookieSameSite diharapkan strict, didapat: %s", cfg.CookieSameSite)
	}
}

func TestLoadConfig_MissingDatabaseURL(t *testing.T) {
	os.Setenv("DATABASE_URL", "")
	os.Setenv("JWT_SECRET", "secret")

	_, err := LoadConfig()
	if err == nil {
		t.Fatalf("LoadConfig() seharusnya gagal saat DATABASE_URL kosong")
	}
}

func TestLoadConfig_MissingJWTSecret(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://localhost:5432/db")
	os.Setenv("JWT_SECRET", "")

	_, err := LoadConfig()
	if err == nil {
		t.Fatalf("LoadConfig() seharusnya gagal saat JWT_SECRET kosong")
	}
}

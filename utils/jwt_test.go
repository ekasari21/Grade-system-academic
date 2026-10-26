package utils

import (
	"testing"
	"time"
)

func TestGenerateAndValidateToken_Success(t *testing.T) {
	secret := "test-kunci-rahasia-123456789"
	userID := uint(42)
	email := "dosen@kampus.ac.id"
	role := "dosen"
	duration := 15 * time.Minute

	tokenStr, err := GenerateToken(userID, email, role, secret, duration)
	if err != nil {
		t.Fatalf("GenerateToken gagal: %v", err)
	}
	if tokenStr == "" {
		t.Fatalf("Token tidak boleh kosong")
	}

	claims, err := ValidateToken(tokenStr, secret)
	if err != nil {
		t.Fatalf("ValidateToken gagal: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("UserID diharapkan %d, didapat %d", userID, claims.UserID)
	}
	if claims.Email != email {
		t.Errorf("Email diharapkan %s, didapat %s", email, claims.Email)
	}
	if claims.Role != role {
		t.Errorf("Role diharapkan %s, didapat %s", role, claims.Role)
	}
}

func TestValidateToken_Expired(t *testing.T) {
	secret := "test-kunci-rahasia-123456789"
	// Buat token yang sudah kedaluwarsa 1 detik lalu
	tokenStr, err := GenerateToken(1, "test@example.com", "mahasiswa", secret, -1*time.Second)
	if err != nil {
		t.Fatalf("GenerateToken gagal: %v", err)
	}

	_, err = ValidateToken(tokenStr, secret)
	if err == nil {
		t.Errorf("ValidateToken seharusnya menolak token yang telah kedaluwarsa")
	}
}

func TestValidateToken_WrongSecret(t *testing.T) {
	secret1 := "kunci-pertama-12345"
	secret2 := "kunci-kedua-salah-67890"

	tokenStr, err := GenerateToken(1, "test@example.com", "admin", secret1, 15*time.Minute)
	if err != nil {
		t.Fatalf("GenerateToken gagal: %v", err)
	}

	_, err = ValidateToken(tokenStr, secret2)
	if err == nil {
		t.Errorf("ValidateToken seharusnya menolak token jika secret tidak cocok")
	}
}

func TestGenerateToken_EmptySecret(t *testing.T) {
	_, err := GenerateToken(1, "test@example.com", "admin", "", 15*time.Minute)
	if err == nil {
		t.Errorf("GenerateToken seharusnya error saat secret kosong")
	}
}

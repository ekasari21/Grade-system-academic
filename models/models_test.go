package models

import (
	"testing"
)

func TestUser_PasswordHashing(t *testing.T) {
	user := User{
		Name:  "Budi Santoso",
		Email: "budi@example.com",
		Role:  RoleMahasiswa,
	}

	// 1. Uji password terlalu pendek (< 6 karakter)
	err := user.SetPassword("12345")
	if err == nil {
		t.Errorf("SetPassword seharusnya menolak password di bawah 6 karakter")
	}

	// 2. Uji password valid
	err = user.SetPassword("rahasia123")
	if err != nil {
		t.Fatalf("SetPassword gagal: %v", err)
	}

	// Password tidak boleh kosong dan tidak boleh plain text
	if user.Password == "" || user.Password == "rahasia123" {
		t.Errorf("Password harus di-hash, tidak boleh bernilai plain text")
	}

	// 3. Uji kecocokan password benar
	if !user.CheckPassword("rahasia123") {
		t.Errorf("CheckPassword gagal memvalidasi password yang benar")
	}

	// 4. Uji penolakan password salah
	if user.CheckPassword("passwordsalah") {
		t.Errorf("CheckPassword seharusnya menolak password yang salah")
	}
}

func TestRoles_Constants(t *testing.T) {
	if RoleAdmin != "admin" {
		t.Errorf("RoleAdmin diharapkan 'admin'")
	}
	if RoleDosen != "dosen" {
		t.Errorf("RoleDosen diharapkan 'dosen'")
	}
	if RoleMahasiswa != "mahasiswa" {
		t.Errorf("RoleMahasiswa diharapkan 'mahasiswa'")
	}
}

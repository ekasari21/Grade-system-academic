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

func TestCourseCPL_Creation(t *testing.T) {
	cpl := CourseCPL{
		CourseID:    1,
		Code:        "CPL-1",
		Description: "Penguasaan konsep teoritis dasar",
		TargetScore: 70.0,
	}

	if cpl.Code != "CPL-1" {
		t.Errorf("Code diharapkan CPL-1, didapat: %s", cpl.Code)
	}
	if cpl.TargetScore != 70.0 {
		t.Errorf("TargetScore diharapkan 70.0, didapat: %.2f", cpl.TargetScore)
	}
}

func TestGradeCPLDetail_Structure(t *testing.T) {
	detail := GradeCPLDetail{
		GradeID:     10,
		CourseCPLID: 1,
		CPLCode:     "CPL-1",
		CPLDesc:     "Deskripsi",
		Score:       82.50,
		Weight:      40.0,
		TargetScore: 70.0,
		Status:      "Tercapai",
		Components:  "Tugas (20%), Kuis (20%)",
	}

	if detail.Status != "Tercapai" {
		t.Errorf("Status diharapkan Tercapai, didapat: %s", detail.Status)
	}
	if detail.Score != 82.50 {
		t.Errorf("Score diharapkan 82.50, didapat: %.2f", detail.Score)
	}
}

func TestCourseAssessmentItem_Structure(t *testing.T) {
	item := CourseAssessmentItem{
		CourseID:    1,
		Name:        "Tugas",
		Category:    "tugas",
		Weight:      20.0,
		CourseCPLID: 2,
		OrderIndex:  1,
	}

	if item.Name != "Tugas" || item.Weight != 20.0 || item.Category != "tugas" {
		t.Errorf("CourseAssessmentItem data tidak cocok: %+v", item)
	}
}

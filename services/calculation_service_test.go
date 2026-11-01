package services

import (
	"math"
	"testing"
)

func TestWeightsSumTo100Percent(t *testing.T) {
	total := WeightAssignment + WeightQuiz + WeightMidterm + WeightFinalExam
	if math.Abs(total-1.0) > 0.0001 {
		t.Errorf("Total bobot harus tepat 1.0 (100%%), didapat: %f", total)
	}
}

func TestCalculateFinalScore_ExampleFromSpec(t *testing.T) {
	res, err := CalculateGrade(85, 80, 75, 90)
	if err != nil {
		t.Fatalf("CalculateGrade() gagal: %v", err)
	}

	expectedScore := 83.25
	if res.FinalScore != expectedScore {
		t.Errorf("Nilai akhir diharapkan %.2f, didapat: %.2f", expectedScore, res.FinalScore)
	}

	expectedLetter := "AB"
	if res.LetterGrade != expectedLetter {
		t.Errorf("Nilai huruf diharapkan %s, didapat: %s", expectedLetter, res.LetterGrade)
	}

	expectedPredicate := "Baik Sekali"
	if res.Predicate != expectedPredicate {
		t.Errorf("Predikat diharapkan %s, didapat: %s", expectedPredicate, res.Predicate)
	}
}

func TestDetermineLetterGrade_AllBrackets(t *testing.T) {
	tests := []struct {
		score             float64
		expectedLetter    string
		expectedPredicate string
	}{
		{100.0, "A", "Sangat Baik"},
		{85.0, "A", "Sangat Baik"},
		{84.99, "AB", "Baik Sekali"},
		{80.0, "AB", "Baik Sekali"},
		{79.99, "B", "Baik"},
		{75.0, "B", "Baik"},
		{74.99, "BC", "Cukup Baik"},
		{70.0, "BC", "Cukup Baik"},
		{69.99, "C", "Cukup"},
		{65.0, "C", "Cukup"},
		{64.99, "D", "Kurang"},
		{50.0, "D", "Kurang"},
		{49.99, "E", "Sangat Kurang"},
		{0.0, "E", "Sangat Kurang"},
	}

	for _, tc := range tests {
		letter, predicate, err := DetermineLetterGrade(tc.score)
		if err != nil {
			t.Errorf("Score %.2f mengembalikan error: %v", tc.score, err)
			continue
		}
		if letter != tc.expectedLetter {
			t.Errorf("Score %.2f: Huruf diharapkan %s, didapat %s", tc.score, tc.expectedLetter, letter)
		}
		if predicate != tc.expectedPredicate {
			t.Errorf("Score %.2f: Predikat diharapkan %s, didapat %s", tc.score, tc.expectedPredicate, predicate)
		}
	}
}

func TestValidation_OutOfRangeScores(t *testing.T) {
	_, err := CalculateGrade(-5, 80, 80, 80)
	if err == nil {
		t.Errorf("Seharusnya gagal saat Tugas bernilai negatif")
	}

	_, err = CalculateGrade(80, 105, 80, 80)
	if err == nil {
		t.Errorf("Seharusnya gagal saat Kuis lebih dari 100")
	}

	_, err = CalculateGrade(80, 80, 120, 80)
	if err == nil {
		t.Errorf("Seharusnya gagal saat UTS lebih dari 100")
	}

	_, err = CalculateGrade(80, 80, 80, -1)
	if err == nil {
		t.Errorf("Seharusnya gagal saat UAS bernilai negatif")
	}
}

func TestCalculateGradeWithCPL_OBESpec(t *testing.T) {
	// Ketentuan OBE:
	// Tugas: mengukur CPL-1 (bobot 20%, nilai 85)
	// Kuis: mengukur CPL-1 (bobot 20%, nilai 80)
	// UTS: mengukur CPL-2 (bobot 25%, nilai 75)
	// UAS: mengukur CPL-3 (bobot 35%, nilai 90)
	// Target minimal CPL = 70.0
	components := []ComponentScore{
		{Name: "Tugas", Score: 85, Weight: 0.20, CPLID: 1, CPLCode: "CPL-1", CPLDesc: "Konsep Dasar", TargetScore: 70},
		{Name: "Kuis", Score: 80, Weight: 0.20, CPLID: 1, CPLCode: "CPL-1", CPLDesc: "Konsep Dasar", TargetScore: 70},
		{Name: "UTS", Score: 75, Weight: 0.25, CPLID: 2, CPLCode: "CPL-2", CPLDesc: "Analisis Masalah", TargetScore: 70},
		{Name: "UAS", Score: 90, Weight: 0.35, CPLID: 3, CPLCode: "CPL-3", CPLDesc: "Implementasi Solusi", TargetScore: 70},
	}

	res, err := CalculateGradeWithCPL(components)
	if err != nil {
		t.Fatalf("CalculateGradeWithCPL gagal: %v", err)
	}

	// Nilai Akhir = (85*0.2) + (80*0.2) + (75*0.25) + (90*0.35) = 17 + 16 + 18.75 + 31.5 = 83.25
	if res.FinalScore != 83.25 {
		t.Errorf("FinalScore diharapkan 83.25, didapat: %.2f", res.FinalScore)
	}
	if res.LetterGrade != "AB" {
		t.Errorf("LetterGrade diharapkan AB, didapat: %s", res.LetterGrade)
	}

	// Ketercapaian CPL: 3 CPL diukur, ketiganya >= 70 -> 100%
	if res.CPLTotalCount != 3 {
		t.Errorf("Total CPL diharapkan 3, didapat: %d", res.CPLTotalCount)
	}
	if res.CPLAchievedCount != 3 {
		t.Errorf("Jumlah CPL tercapai diharapkan 3, didapat: %d", res.CPLAchievedCount)
	}
	if res.CPLAchievementRate != 100.0 {
		t.Errorf("Persentase ketercapaian diharapkan 100%%, didapat: %.2f%%", res.CPLAchievementRate)
	}
	if len(res.UnachievedCPLCodes) != 0 {
		t.Errorf("Seharusnya tidak ada CPL yang belum tercapai")
	}

	// CPL-1 Nilai = (85*0.2 + 80*0.2) / 0.4 = 82.50
	cpl1 := res.CPLResults[0]
	if cpl1.CPLCode != "CPL-1" || cpl1.Score != 82.50 || cpl1.Status != "Tercapai" {
		t.Errorf("Data CPL-1 tidak valid: %+v", cpl1)
	}
}

func TestCalculateGradeWithCPL_Target70Threshold(t *testing.T) {
	// Uji batas target ketercapaian 70.0:
	// CPL-1 nilai 70.00 -> Tercapai
	// CPL-2 nilai 69.90 -> Belum Tercapai
	components := []ComponentScore{
		{Name: "Tugas", Score: 70.00, Weight: 0.50, CPLID: 1, CPLCode: "CPL-1", TargetScore: 70.0},
		{Name: "UTS", Score: 69.90, Weight: 0.50, CPLID: 2, CPLCode: "CPL-2", TargetScore: 70.0},
	}

	res, err := CalculateGradeWithCPL(components)
	if err != nil {
		t.Fatalf("CalculateGradeWithCPL gagal: %v", err)
	}

	if res.CPLResults[0].Status != "Tercapai" {
		t.Errorf("CPL-1 seharusnya Tercapai karena nilai >= 70, didapat: %s", res.CPLResults[0].Status)
	}
	if res.CPLResults[1].Status != "Belum Tercapai" {
		t.Errorf("CPL-2 seharusnya Belum Tercapai karena nilai < 70, didapat: %s", res.CPLResults[1].Status)
	}

	// 1 dari 2 tercapai -> 50%
	if res.CPLAchievedCount != 1 || res.CPLTotalCount != 2 || res.CPLAchievementRate != 50.0 {
		t.Errorf("Statistik CPL salah: Achieved=%d, Total=%d, Rate=%.2f%%", res.CPLAchievedCount, res.CPLTotalCount, res.CPLAchievementRate)
	}

	// CPL-2 harus masuk daftar UnachievedCPLCodes
	if len(res.UnachievedCPLCodes) != 1 || res.UnachievedCPLCodes[0] != "CPL-2" {
		t.Errorf("UnachievedCPLCodes diharapkan [CPL-2], didapat: %v", res.UnachievedCPLCodes)
	}
}

func TestCalculateGradeWithCPL_UASMultipleCPLSubItems(t *testing.T) {
	// Aturan 3 point 5: "Jika satu komponen mengukur beberapa CPL, sediakan subnilai atau instrumen penilaian terpisah untuk setiap CPL."
	// Misal: UAS (total 35%) dibagi:
	// - UAS Bagian Teori: mengukur CPL-2 (bobot 15%, nilai 60)
	// - UAS Bagian Proyek: mengukur CPL-3 (bobot 20%, nilai 85)
	components := []ComponentScore{
		{Name: "Tugas", Score: 90, Weight: 0.20, CPLID: 1, CPLCode: "CPL-1", TargetScore: 70},
		{Name: "Kuis", Score: 85, Weight: 0.20, CPLID: 1, CPLCode: "CPL-1", TargetScore: 70},
		{Name: "UTS", Score: 80, Weight: 0.25, CPLID: 2, CPLCode: "CPL-2", TargetScore: 70},
		{Name: "UAS - Sub 1", Score: 60, Weight: 0.15, CPLID: 2, CPLCode: "CPL-2", TargetScore: 70},
		{Name: "UAS - Sub 2", Score: 85, Weight: 0.20, CPLID: 3, CPLCode: "CPL-3", TargetScore: 70},
	}

	res, err := CalculateGradeWithCPL(components)
	if err != nil {
		t.Fatalf("CalculateGradeWithCPL gagal: %v", err)
	}

	// Total bobot: 0.2 + 0.2 + 0.25 + 0.15 + 0.20 = 1.0 (100%)
	// Nilai Akhir: (90*0.2) + (85*0.2) + (80*0.25) + (60*0.15) + (85*0.20)
	// = 18 + 17 + 20 + 9 + 17 = 81.00
	if res.FinalScore != 81.00 {
		t.Errorf("FinalScore diharapkan 81.00, didapat: %.2f", res.FinalScore)
	}

	// CPL-2 diukur oleh UTS (25%, nilai 80) dan UAS Sub 1 (15%, nilai 60)
	// Bobot CPL-2 = 40% (0.40)
	// Sesuai OBE: Nilai CPL-2 = (80 + 60) / 2 = 70.00
	cpl2 := res.CPLResults[1]
	if cpl2.CPLCode != "CPL-2" || cpl2.Score != 70.00 || cpl2.Status != "Tercapai" {
		t.Errorf("CPL-2 salah: %+v", cpl2)
	}
}

func TestCalculateGradeWithCPL_UserOBEExample(t *testing.T) {
	// Contoh kasus dari pengguna:
	// Tugas: CPL-03, Bobot 20%, Nilai 85
	// Kuis: CPL-02, Bobot 15%, Nilai 80
	// UTS: CPL-04, Bobot 25%, Nilai 75
	// UAS Bagian A: CPL-04, Bobot 20%, Nilai 80
	// UAS Bagian B: CPL-05, Bobot 20%, Nilai 90
	components := []ComponentScore{
		{Name: "Tugas", Score: 85, Weight: 0.20, CPLID: 3, CPLCode: "CPL-03", TargetScore: 70},
		{Name: "Kuis", Score: 80, Weight: 0.15, CPLID: 2, CPLCode: "CPL-02", TargetScore: 70},
		{Name: "UTS", Score: 75, Weight: 0.25, CPLID: 4, CPLCode: "CPL-04", TargetScore: 70},
		{Name: "UAS bagian A", Score: 80, Weight: 0.20, CPLID: 4, CPLCode: "CPL-04", TargetScore: 70},
		{Name: "UAS bagian B", Score: 90, Weight: 0.20, CPLID: 5, CPLCode: "CPL-05", TargetScore: 70},
	}

	res, err := CalculateGradeWithCPL(components)
	if err != nil {
		t.Fatalf("CalculateGradeWithCPL gagal: %v", err)
	}

	// 1. Nilai Akhir Akademik: (85*0.2) + (80*0.15) + (75*0.25) + (80*0.2) + (90*0.2)
	// = 17 + 12 + 18.75 + 16 + 18 = 81.75
	if res.FinalScore != 81.75 {
		t.Errorf("Nilai akhir diharapkan 81.75, didapat: %.2f", res.FinalScore)
	}
	if res.LetterGrade != "AB" || res.Predicate != "Baik Sekali" {
		t.Errorf("Mutu diharapkan AB (Baik Sekali), didapat: %s (%s)", res.LetterGrade, res.Predicate)
	}

	// 2. Evaluasi Nilai CPL:
	// CPL-03 = 85 (Bobot 20%)
	// CPL-02 = 80 (Bobot 15%)
	// CPL-04 = (75 + 80) / 2 = 77.50 (Bobot 25% + 20% = 45%)
	// CPL-05 = 90 (Bobot 20%)
	cplMap := make(map[string]CPLCalculationResult)
	for _, c := range res.CPLResults {
		cplMap[c.CPLCode] = c
	}

	if cplMap["CPL-02"].Score != 80.0 || cplMap["CPL-02"].Status != "Tercapai" || cplMap["CPL-02"].Weight != 15.0 {
		t.Errorf("CPL-02 salah: %+v", cplMap["CPL-02"])
	}
	if cplMap["CPL-03"].Score != 85.0 || cplMap["CPL-03"].Status != "Tercapai" || cplMap["CPL-03"].Weight != 20.0 {
		t.Errorf("CPL-03 salah: %+v", cplMap["CPL-03"])
	}
	if cplMap["CPL-04"].Score != 77.5 || cplMap["CPL-04"].Status != "Tercapai" || cplMap["CPL-04"].Weight != 45.0 {
		t.Errorf("CPL-04 salah: %+v", cplMap["CPL-04"])
	}
	if cplMap["CPL-05"].Score != 90.0 || cplMap["CPL-05"].Status != "Tercapai" || cplMap["CPL-05"].Weight != 20.0 {
		t.Errorf("CPL-05 salah: %+v", cplMap["CPL-05"])
	}

	// 3. Persentase Ketercapaian = 4/4 = 100%
	if res.CPLAchievementRate != 100.0 || res.CPLAchievedCount != 4 || res.CPLTotalCount != 4 {
		t.Errorf("Ketercapaian CPL salah: Rate=%.2f%%, Achieved=%d, Total=%d", res.CPLAchievementRate, res.CPLAchievedCount, res.CPLTotalCount)
	}
}

func TestCalculateGradeWithCPL_InvalidWeight(t *testing.T) {
	components := []ComponentScore{
		{Name: "Tugas", Score: 80, Weight: 0.10, CPLID: 1, CPLCode: "CPL-1"},
		{Name: "Kuis", Score: 80, Weight: 0.20, CPLID: 1, CPLCode: "CPL-1"},
	}
	_, err := CalculateGradeWithCPL(components)
	if err == nil {
		t.Errorf("CalculateGradeWithCPL seharusnya gagal jika total bobot bukan 100%%")
	}
}

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
	// Contoh dari spesifikasi:
	// Tugas = 85, Kuis = 80, UTS = 75, UAS = 90
	// Nilai Akhir = 17 + 16 + 18.75 + 31.5 = 83.25
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
	// Nilai negatif
	_, err := CalculateGrade(-5, 80, 80, 80)
	if err == nil {
		t.Errorf("Seharusnya gagal saat Tugas bernilai negatif")
	}

	// Nilai lebih dari 100
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

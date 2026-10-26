package services

import (
	"errors"
	"fmt"
	"math"
)

// Bobot komponen penilaian sesuai spesifikasi
const (
	WeightAssignment = 0.20 // Tugas: 20%
	WeightQuiz       = 0.20 // Kuis: 20%
	WeightMidterm    = 0.25 // UTS: 25%
	WeightFinalExam  = 0.35 // UAS: 35%
)

// GradeCalculationResult menampung hasil kalkulasi nilai
type GradeCalculationResult struct {
	FinalScore  float64 `json:"final_score"`
	LetterGrade string  `json:"letter_grade"`
	Predicate   string  `json:"predicate"`
}

// ValidateScore memastikan angka nilai berada dalam rentang 0 sampai 100
func ValidateScore(name string, score float64) error {
	if score < 0 || score > 100 {
		return fmt.Errorf("nilai %s harus berada di antara 0 dan 100, didapat: %.2f", name, score)
	}
	return nil
}

// ValidateAllScores memvalidasi seluruh komponen nilai sebelum perhitungan
func ValidateAllScores(assignment, quiz, midterm, finalExam float64) error {
	if err := ValidateScore("Tugas", assignment); err != nil {
		return err
	}
	if err := ValidateScore("Kuis", quiz); err != nil {
		return err
	}
	if err := ValidateScore("UTS", midterm); err != nil {
		return err
	}
	if err := ValidateScore("UAS", finalExam); err != nil {
		return err
	}
	return nil
}

// CalculateFinalScore menghitung nilai akhir berdasarkan bobot:
// (Tugas * 0.20) + (Kuis * 0.20) + (UTS * 0.25) + (UAS * 0.35)
func CalculateFinalScore(assignment, quiz, midterm, finalExam float64) (float64, error) {
	if err := ValidateAllScores(assignment, quiz, midterm, finalExam); err != nil {
		return 0, err
	}

	score := (assignment * WeightAssignment) +
		(quiz * WeightQuiz) +
		(midterm * WeightMidterm) +
		(finalExam * WeightFinalExam)

	// Pembulatan ke 2 tempat desimal untuk presisi yang konsisten
	roundedScore := math.Round(score*100) / 100
	return roundedScore, nil
}

// DetermineLetterGrade mengonversi nilai akhir menjadi nilai huruf dan predikat
// sesuai rentang nilai pada spesifikasi:
// 85 - 100    : A  (Sangat Baik)
// 80 - 84.99  : AB (Baik Sekali)
// 75 - 79.99  : B  (Baik)
// 70 - 74.99  : BC (Cukup Baik)
// 65 - 69.99  : C  (Cukup)
// 50 - 64.99  : D  (Kurang)
// 0  - 49.99  : E  (Sangat Kurang)
func DetermineLetterGrade(finalScore float64) (letterGrade string, predicate string, err error) {
	if finalScore < 0 || finalScore > 100 {
		return "", "", errors.New("nilai akhir harus berada dalam rentang 0 sampai 100")
	}

	switch {
	case finalScore >= 85.0:
		return "A", "Sangat Baik", nil
	case finalScore >= 80.0:
		return "AB", "Baik Sekali", nil
	case finalScore >= 75.0:
		return "B", "Baik", nil
	case finalScore >= 70.0:
		return "BC", "Cukup Baik", nil
	case finalScore >= 65.0:
		return "C", "Cukup", nil
	case finalScore >= 50.0:
		return "D", "Kurang", nil
	default:
		return "E", "Sangat Kurang", nil
	}
}

// CalculateGrade menjalankan alur lengkap validasi, kalkulasi nilai akhir, dan konversi huruf
func CalculateGrade(assignment, quiz, midterm, finalExam float64) (*GradeCalculationResult, error) {
	finalScore, err := CalculateFinalScore(assignment, quiz, midterm, finalExam)
	if err != nil {
		return nil, err
	}

	letter, predicate, err := DetermineLetterGrade(finalScore)
	if err != nil {
		return nil, err
	}

	return &GradeCalculationResult{
		FinalScore:  finalScore,
		LetterGrade: letter,
		Predicate:   predicate,
	}, nil
}

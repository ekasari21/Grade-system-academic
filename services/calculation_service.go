package services

import (
	"errors"
	"fmt"
	"math"
	"strings"
)

// Standar Target Ketercapaian Minimal CPL sesuai pedoman OBE
const DefaultCPLTargetScore = 70.00

// Bobot default komponen penilaian (dapat disesuaikan oleh dosen per mata kuliah)
const (
	WeightAssignment = 0.20 // Tugas: 20%
	WeightQuiz       = 0.20 // Kuis: 20%
	WeightMidterm    = 0.25 // UTS: 25%
	WeightFinalExam  = 0.35 // UAS: 35%
)

// ComponentScore mendefinisikan rincian nilai, bobot, dan pemetaan CPL untuk setiap instrumen penilaian
type ComponentScore struct {
	Name        string  `json:"name"`         // Nama instrumen: misal "Tugas", "Kuis", "UTS", "UAS Bagian 1"
	Category    string  `json:"category"`     // Kategori: "tugas", "kuis", "uts", "uas"
	Score       float64 `json:"score"`        // Nilai komponen (0 - 100)
	Weight      float64 `json:"weight"`       // Bobot relatif (desimal 0.20 atau persentase 20.0)
	CPLID       uint    `json:"cpl_id"`       // ID CPL yang diukur
	CPLCode     string  `json:"cpl_code"`     // Kode CPL (misal: "CPL-1")
	CPLDesc     string  `json:"cpl_desc"`     // Deskripsi CPL
	TargetScore float64 `json:"target_score"` // Target minimal kelulusan CPL (default: 70)
}

// CPLCalculationResult menampung hasil perhitungan evaluasi ketercapaian suatu CPL
type CPLCalculationResult struct {
	CPLID       uint    `json:"cpl_id"`
	CPLCode     string  `json:"cpl_code"`
	CPLDesc     string  `json:"cpl_desc"`
	Score       float64 `json:"score"`        // Rata-rata tertimbang komponen yang mengukur CPL ini (0 - 100)
	Weight      float64 `json:"weight"`       // Total bobot komponen yang mengukur CPL ini dalam MK (%)
	TargetScore float64 `json:"target_score"` // Target minimal ketercapaian (standar OBE: 70.0)
	Status      string  `json:"status"`       // "Tercapai" (>= 70) atau "Belum Tercapai" (< 70)
	Components  string  `json:"components"`   // Daftar komponen pembentuk, misal: "Tugas (20%), Kuis (20%)"
}

// GradeCalculationResult menampung hasil lengkap perhitungan OBE mahasiswa
type GradeCalculationResult struct {
	FinalScore         float64                `json:"final_score"`          // Nilai Akhir = Σ (Nilai Komponen × Bobot Komponen)
	LetterGrade        string                 `json:"letter_grade"`         // Huruf Mutu
	Predicate          string                 `json:"predicate"`            // Predikat Kelulusan
	CPLResults         []CPLCalculationResult `json:"cpl_results"`          // Nilai dan status masing-masing CPL
	CPLAchievedCount   int                    `json:"cpl_achieved_count"`   // Jumlah CPL yang tercapai
	CPLTotalCount      int                    `json:"cpl_total_count"`      // Total CPL yang diukur
	CPLAchievementRate float64                `json:"cpl_achievement_rate"` // Persentase Ketercapaian = (Tercapai / Total) × 100%
	UnachievedCPLCodes []string               `json:"unachieved_cpl_codes"` // Daftar CPL yang belum tercapai untuk evaluasi (CQI)
}

// ValidateScore memastikan angka nilai berada dalam rentang 0 sampai 100
func ValidateScore(name string, score float64) error {
	if score < 0 || score > 100 {
		return fmt.Errorf("nilai %s harus berada di antara 0 dan 100, didapat: %.2f", name, score)
	}
	return nil
}

// ValidateAllScores memvalidasi komponen nilai standar
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

// DetermineLetterGrade mengonversi nilai akhir menjadi nilai huruf dan predikat
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

// CalculateFinalScore menghitung nilai akhir dengan bobot standar spesifikasi awal
func CalculateFinalScore(assignment, quiz, midterm, finalExam float64) (float64, error) {
	if err := ValidateAllScores(assignment, quiz, midterm, finalExam); err != nil {
		return 0, err
	}

	score := (assignment * WeightAssignment) +
		(quiz * WeightQuiz) +
		(midterm * WeightMidterm) +
		(finalExam * WeightFinalExam)

	roundedScore := math.Round(score*100) / 100
	return roundedScore, nil
}

// CalculateGrade menjalankan kalkulasi nilai akhir dan huruf mutu (standar kompatibilitas)
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

// CalculateGradeWithCPL menghitung nilai akhir mata kuliah dan evaluasi ketercapaian CPL sesuai aturan OBE:
// 1. Nilai Akhir = Σ (Nilai Komponen × Bobot Komponen) dengan total bobot = 100%.
// 2. Nilai CPL = Rata-rata tertimbang komponen yang mengukur CPL tersebut: (Σ Nilai × Bobot) / (Σ Bobot).
// 3. Status CPL: Tercapai jika Nilai CPL >= 70, Belum Tercapai jika < 70.
// 4. Persentase Ketercapaian CPL = (Jumlah CPL Tercapai / Total CPL) × 100%.
func CalculateGradeWithCPL(components []ComponentScore) (*GradeCalculationResult, error) {
	if len(components) == 0 {
		return nil, errors.New("komponen penilaian tidak boleh kosong")
	}

	// Normalisasi bobot jika pengguna mengirim persentase (misal 20 bukan 0.20)
	totalWeightInput := 0.0
	for _, comp := range components {
		totalWeightInput += comp.Weight
	}

	isPercentageScale := totalWeightInput > 1.5 // Misal total ~100 daripada ~1.0

	normalizedComps := make([]ComponentScore, len(components))
	totalWeight := 0.0

	for i, comp := range components {
		if err := ValidateScore(comp.Name, comp.Score); err != nil {
			return nil, err
		}
		if comp.Weight < 0 {
			return nil, fmt.Errorf("bobot komponen %s tidak boleh negatif", comp.Name)
		}

		w := comp.Weight
		if isPercentageScale {
			w = comp.Weight / 100.0
		}

		normalizedComps[i] = comp
		normalizedComps[i].Weight = w
		totalWeight += w
	}

	// Validasi total bobot seluruh komponen harus tepat 100% (1.0)
	if math.Abs(totalWeight-1.0) > 0.005 {
		return nil, fmt.Errorf("total bobot seluruh komponen penilaian harus tepat 100%% (1.0), saat ini: %.2f%%", totalWeight*100)
	}

	// 1. Hitung Nilai Akhir Mahasiswa: Nilai Akhir = Σ (Nilai Komponen × Bobot Komponen)
	finalScoreRaw := 0.0
	for _, comp := range normalizedComps {
		finalScoreRaw += (comp.Score * comp.Weight)
	}
	finalScore := math.Round(finalScoreRaw*100) / 100

	// 2. Hitung Nilai Masing-Masing CPL: Sesuai pedoman OBE, nilai CPL mengukur penguasaan kompetensi
	// dari rata-rata instrumen/subnilai yang mengukur CPL tersebut (misal: UTS 75 dan UAS-A 80 -> CPL-04 = (75+80)/2 = 77.5).
	// Sedangkan bobot CPL dihitung dari total bobot komponen yang mengukur CPL tersebut (misal: 25% + 20% = 45%).
	type cplAccumulator struct {
		id          uint
		code        string
		desc        string
		targetScore float64
		totalWeight float64
		weightedSum float64
		scoreSum    float64
		itemCount   int
		compParts   []string
	}

	cplOrder := make([]string, 0)
	cplMap := make(map[string]*cplAccumulator)

	for _, comp := range normalizedComps {
		key := fmt.Sprintf("%d_%s", comp.CPLID, comp.CPLCode)
		if comp.CPLID == 0 && comp.CPLCode == "" {
			key = "default"
		}

		acc, exists := cplMap[key]
		if !exists {
			target := comp.TargetScore
			if target <= 0 {
				target = DefaultCPLTargetScore // Standar OBE: 70
			}
			acc = &cplAccumulator{
				id:          comp.CPLID,
				code:        comp.CPLCode,
				desc:        comp.CPLDesc,
				targetScore: target,
				compParts:   make([]string, 0),
			}
			cplMap[key] = acc
			cplOrder = append(cplOrder, key)
		}

		acc.totalWeight += comp.Weight
		acc.weightedSum += (comp.Score * comp.Weight)
		acc.scoreSum += comp.Score
		acc.itemCount++
		acc.compParts = append(acc.compParts, fmt.Sprintf("%s (%.0f%%)", comp.Name, comp.Weight*100))
	}

	cplResults := make([]CPLCalculationResult, 0, len(cplOrder))
	achievedCount := 0
	unachievedCodes := make([]string, 0)

	for _, key := range cplOrder {
		acc := cplMap[key]
		cplScore := 0.0
		if acc.itemCount > 0 {
			// Nilai CPL = Rata-rata dari seluruh instrumen/subnilai yang mengukur CPL ini
			cplScore = acc.scoreSum / float64(acc.itemCount)
		}
		cplScoreRounded := math.Round(cplScore*100) / 100
		cplWeightPct := math.Round(acc.totalWeight*10000) / 100

		status := "Belum Tercapai"
		if cplScoreRounded >= acc.targetScore {
			status = "Tercapai"
			achievedCount++
		} else {
			unachievedCodes = append(unachievedCodes, acc.code)
		}

		cplResults = append(cplResults, CPLCalculationResult{
			CPLID:       acc.id,
			CPLCode:     acc.code,
			CPLDesc:     acc.desc,
			Score:       cplScoreRounded,
			Weight:      cplWeightPct,
			TargetScore: acc.targetScore,
			Status:      status,
			Components:  strings.Join(acc.compParts, ", "),
		})
	}

	// 3. Hitung Persentase Ketercapaian CPL: (Jumlah CPL Tercapai / Total CPL yang Diukur) × 100%
	totalCPL := len(cplResults)
	achievementRate := 0.0
	if totalCPL > 0 {
		achievementRate = math.Round((float64(achievedCount)/float64(totalCPL))*10000) / 100
	}

	letter, predicate, err := DetermineLetterGrade(finalScore)
	if err != nil {
		return nil, err
	}

	return &GradeCalculationResult{
		FinalScore:         finalScore,
		LetterGrade:        letter,
		Predicate:          predicate,
		CPLResults:         cplResults,
		CPLAchievedCount:   achievedCount,
		CPLTotalCount:      totalCPL,
		CPLAchievementRate: achievementRate,
		UnachievedCPLCodes: unachievedCodes,
	}, nil
}

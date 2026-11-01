package controllers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/models"
	"go_vibe/utils"
)

// AuthController menangani proses autentikasi (register, login, logout, me)
type AuthController struct {
	cfg *config.Config
}

// NewAuthController membuat instance baru AuthController
func NewAuthController(cfg *config.Config) *AuthController {
	return &AuthController{cfg: cfg}
}

// RegisterInput mendefinisikan payload data registrasi akun
type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role"`  // "admin", "dosen", "mahasiswa" (default: mahasiswa)
	NIM      string `json:"nim"`   // Diisi jika mendaftar sebagai mahasiswa
	Major    string `json:"major"` // Jurusan jika mendaftar sebagai mahasiswa
}

// LoginInput mendefinisikan payload data login
type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register menangani pembuatan akun baru
func (ac *AuthController) Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	// Normalisasi email ke lowercase
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))

	// Periksa apakah email sudah terdaftar
	var existingUser models.User
	if err := config.DB.Where("email = ?", input.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email sudah digunakan oleh akun lain"})
		return
	}

	// Tetapkan role default ke mahasiswa jika kosong atau tidak valid
	role := strings.ToLower(strings.TrimSpace(input.Role))
	if role != models.RoleAdmin && role != models.RoleDosen {
		role = models.RoleMahasiswa
	}

	newUser := models.User{
		Name:  strings.TrimSpace(input.Name),
		Email: input.Email,
		Role:  role,
	}

	if err := newUser.SetPassword(input.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Simpan User ke database
	if err := config.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan akun pengguna"})
		return
	}

	// Jika mendaftar sebagai mahasiswa dan menyertakan NIM, otomatis buat profil Student
	if role == models.RoleMahasiswa && strings.TrimSpace(input.NIM) != "" {
		major := strings.TrimSpace(input.Major)
		if major == "" {
			major = "Umum"
		}

		student := models.Student{
			UserID: &newUser.ID,
			NIM:    strings.TrimSpace(input.NIM),
			Name:   newUser.Name,
			Major:  major,
		}
		// Buat student profile (jika NIM duplikat, abaikan error profil tapi akun tetap terbuat)
		_ = config.DB.Create(&student)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registrasi akun berhasil",
		"user": gin.H{
			"id":    newUser.ID,
			"name":  newUser.Name,
			"email": newUser.Email,
			"role":  newUser.Role,
		},
	})
}

// Login menangani autentikasi pengguna dan penyematan token JWT ke HttpOnly Cookie
func (ac *AuthController) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email dan password wajib diisi"})
		return
	}

	input.Email = strings.ToLower(strings.TrimSpace(input.Email))

	// Cari pengguna berdasarkan email
	var user models.User
	if err := config.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		// Pesan error umum agar tidak membocorkan keberadaan email
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau kata sandi tidak sesuai"})
		return
	}

	// Verifikasi kata sandi
	if !user.CheckPassword(input.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau kata sandi tidak sesuai"})
		return
	}

	// Durasi masa aktif JWT (default 15 menit sesuai .env)
	duration, err := time.ParseDuration(ac.cfg.JWTExpiresIn)
	if err != nil {
		duration = 15 * time.Minute
	}

	// Buat token JWT
	tokenString, err := utils.GenerateToken(user.ID, user.Email, user.Role, ac.cfg.JWTSecret, duration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghasilkan token autentikasi"})
		return
	}

	// Simpan JWT ke dalam Cookie HttpOnly
	maxAge := int(duration.Seconds())
	c.SetCookie(
		"token",
		tokenString,
		maxAge,
		"/",
		"",
		ac.cfg.CookieSecure,
		true, // HttpOnly = true (JavaScript browser tidak dapat mengakses)
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil",
		"user": gin.H{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

// GetMe mengembalikan informasi pengguna yang sedang aktif (login)
func (ac *AuthController) GetMe(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Pengguna tidak terautentikasi"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data pengguna tidak ditemukan"})
		return
	}

	// Jika role mahasiswa, sertakan profil data mahasiswanya
	var studentProfile *models.Student
	if user.Role == models.RoleMahasiswa {
		var student models.Student
		if err := config.DB.Where("user_id = ?", user.ID).First(&student).Error; err == nil {
			studentProfile = &student
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":      user.ID,
			"name":    user.Name,
			"email":   user.Email,
			"role":    user.Role,
			"student": studentProfile,
		},
	})
}

// Logout menghapus cookie JWT autentikasi dan cookie CSRF
func (ac *AuthController) Logout(c *gin.Context) {
	// Menghapus cookie dengan mengatur Max-Age ke -1
	c.SetCookie("token", "", -1, "/", "", ac.cfg.CookieSecure, true)
	c.SetCookie("csrf_token", "", -1, "/", "", ac.cfg.CookieSecure, false)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logout berhasil, sesi telah diakhiri",
	})
}

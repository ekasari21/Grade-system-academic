package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/utils"
)

// AuthMiddleware memvalidasi token JWT yang disimpan di dalam cookie HttpOnly
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := c.Cookie("token")
		if err != nil || tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Autentikasi gagal: Anda belum login atau sesi telah berakhir",
			})
			return
		}

		claims, err := utils.ValidateToken(tokenStr, cfg.JWTSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Sesi tidak valid atau telah kedaluwarsa, silakan login kembali",
			})
			return
		}

		// Simpan identitas pengguna ke dalam Gin context untuk digunakan oleh controller
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)

		c.Next()
	}
}

// RoleMiddleware memeriksa apakah pengguna memiliki role yang diizinkan untuk mengakses endpoint
func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Role pengguna tidak teridentifikasi",
			})
			return
		}

		userRole := roleVal.(string)
		isAllowed := false
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Akses ditolak: role Anda tidak memiliki izin untuk fitur ini",
			})
			return
		}

		c.Next()
	}
}

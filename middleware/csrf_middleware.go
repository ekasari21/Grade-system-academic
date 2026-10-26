package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
)

// generateRandomToken membuat token string acak sepanjang 32 byte hex
func generateRandomToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CSRFMiddleware menerapkan perlindungan Cross-Site Request Forgery (Double Submit Cookie)
func CSRFMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieToken, err := c.Cookie("csrf_token")
		if err != nil || cookieToken == "" {
			newToken, err := generateRandomToken()
			if err == nil {
				cookieToken = newToken
				// Cookie CSRF dapat dibaca oleh JavaScript (HttpOnly: false) agar frontend dapat menyematkannya ke header X-CSRF-Token
				c.SetCookie(
					"csrf_token",
					cookieToken,
					24*60*60, // 24 jam
					"/",
					"",
					cfg.CookieSecure,
					false, // HttpOnly = false agar bisa dibaca JS
				)
			}
		}

		// Metode aman (Safe methods) tidak perlu validasi CSRF
		method := c.Request.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			c.Next()
			return
		}

		// Rute autentikasi publik seperti login dan register dikecualikan dari verifikasi ketat CSRF
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/auth/login") || strings.HasPrefix(path, "/api/auth/register") {
			c.Next()
			return
		}

		// Verifikasi header X-CSRF-Token dengan cookie csrf_token
		headerToken := c.GetHeader("X-CSRF-Token")
		if headerToken == "" || cookieToken == "" || headerToken != cookieToken {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Perlindungan CSRF: Token CSRF tidak valid atau tidak cocok",
			})
			return
		}

		c.Next()
	}
}

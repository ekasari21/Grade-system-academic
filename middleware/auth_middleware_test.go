package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/utils"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestAuthMiddleware_UnauthorizedWhenNoCookie(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret-12345"}
	r := gin.New()
	r.Use(AuthMiddleware(cfg))
	r.GET("/test-protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req, _ := http.NewRequest(http.MethodGet, "/test-protected", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Diharapkan status 401 Unauthorized, didapat: %d", w.Code)
	}
}

func TestAuthMiddleware_AuthorizedWithValidCookie(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret-12345"}
	tokenStr, _ := utils.GenerateToken(10, "dosen@example.com", "dosen", cfg.JWTSecret, 15*time.Minute)

	r := gin.New()
	r.Use(AuthMiddleware(cfg))
	r.GET("/test-protected", func(c *gin.Context) {
		userID := c.GetUint("userID")
		role := c.GetString("role")
		c.JSON(http.StatusOK, gin.H{"user_id": userID, "role": role})
	})

	req, _ := http.NewRequest(http.MethodGet, "/test-protected", nil)
	req.AddCookie(&http.Cookie{
		Name:     "token",
		Value:    tokenStr,
		HttpOnly: true,
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Diharapkan status 200 OK, didapat: %d", w.Code)
	}
}

func TestRoleMiddleware_ForbiddenWhenRoleMismatch(t *testing.T) {
	cfg := &config.Config{JWTSecret: "test-secret-12345"}
	// Mahasiswa mencoba mengakses rute khusus Dosen
	tokenStr, _ := utils.GenerateToken(20, "mhs@example.com", "mahasiswa", cfg.JWTSecret, 15*time.Minute)

	r := gin.New()
	r.Use(AuthMiddleware(cfg))
	r.Use(RoleMiddleware("dosen", "admin"))
	r.GET("/dosen-only", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req, _ := http.NewRequest(http.MethodGet, "/dosen-only", nil)
	req.AddCookie(&http.Cookie{
		Name:     "token",
		Value:    tokenStr,
		HttpOnly: true,
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Diharapkan status 403 Forbidden untuk mahasiswa di rute dosen, didapat: %d", w.Code)
	}
}

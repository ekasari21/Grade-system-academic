package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go_vibe/config"
	"go_vibe/controllers"
	"go_vibe/middleware"
	"go_vibe/utils"
)

// SetupRouter menginisialisasi rute API, halaman HTML, dan file statis
func SetupRouter(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// Muat template HTML dari folder views/
	r.LoadHTMLGlob("views/*")

	// Melayankan file statis (CSS, JS, aset lain)
	r.Static("/static", "./static")

	// Middleware: Redirect ke dashboard jika sudah login dan mengakses /login atau /register
	redirectIfAuthenticated := func(c *gin.Context) {
		token, err := c.Cookie("token")
		if err == nil && token != "" {
			c.Redirect(http.StatusFound, "/")
			c.Abort()
			return
		}
		c.Next()
	}

	// Pasang middleware CSRF global
	r.Use(middleware.CSRFMiddleware(cfg))

	// Inisialisasi controller
	authCtrl := controllers.NewAuthController(cfg)
	studentCtrl := controllers.NewStudentController()
	courseCtrl := controllers.NewCourseController()
	cplCtrl := controllers.NewCPLController()
	gradeCtrl := controllers.NewGradeController()
	dashboardCtrl := controllers.NewDashboardController()

	// Endpoint health check
	r.GET("/api/health", func(c *gin.Context) {
		dbStatus := "connected"
		if config.DB == nil {
			dbStatus = "disconnected"
		} else {
			sqlDB, err := config.DB.DB()
			if err != nil || sqlDB.Ping() != nil {
				dbStatus = "disconnected"
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"app":      "Student Grade Calculator",
			"status":   "running",
			"database": dbStatus,
		})
	})

	// Rute publik autentikasi
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", authCtrl.Register)
		authGroup.POST("/login", authCtrl.Login)
	}

	// Rute publik pencarian nilai & CPL mahasiswa berbasis NIM (Tanpa Login)
	publicAPIGroup := r.Group("/api/public")
	{
		publicAPIGroup.GET("/student-grades", studentCtrl.GetPublicStudentGrades)
		publicAPIGroup.GET("/student-grades/:nim", studentCtrl.GetPublicStudentGrades)
		publicAPIGroup.GET("/sample-nims", studentCtrl.GetSampleNIMs)
	}

	// Rute privat yang membutuhkan autentikasi JWT
	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg))
	{
		// Identitas sesi aktif & Logout
		protected.GET("/auth/me", authCtrl.GetMe)
		protected.POST("/auth/logout", authCtrl.Logout)

		// Rute privat data akademik
		privateGroup := protected.Group("/private")
		{
			// 1. Dashboard summary
			privateGroup.GET("/dashboard/summary", dashboardCtrl.GetSummary)

			// 2. Data Mahasiswa (Students)
			privateGroup.GET("/students", studentCtrl.GetStudents)
			privateGroup.GET("/students/:id", studentCtrl.GetStudentByID)
			// Operasi pengubah data mahasiswa khusus Dosen dan Admin
			dosenOrAdmin := middleware.RoleMiddleware("dosen", "admin")
			privateGroup.POST("/students", dosenOrAdmin, studentCtrl.CreateStudent)
			privateGroup.PUT("/students/:id", dosenOrAdmin, studentCtrl.UpdateStudent)
			privateGroup.DELETE("/students/:id", dosenOrAdmin, studentCtrl.DeleteStudent)

			// 3. Data Mata Kuliah (Courses) & CPL
			privateGroup.GET("/courses", courseCtrl.GetCourses)
			privateGroup.GET("/courses/:id", courseCtrl.GetCourseByID)
			// Operasi pengubah data mata kuliah khusus Dosen dan Admin
			privateGroup.POST("/courses", dosenOrAdmin, courseCtrl.CreateCourse)
			privateGroup.PUT("/courses/:id", dosenOrAdmin, courseCtrl.UpdateCourse)
			privateGroup.DELETE("/courses/:id", dosenOrAdmin, courseCtrl.DeleteCourse)

			// 3.1 Capaian Pembelajaran Lulusan (CPL) per Mata Kuliah
			privateGroup.GET("/courses/:id/cpls", cplCtrl.GetCourseCPLs)
			privateGroup.POST("/courses/:id/cpls", dosenOrAdmin, cplCtrl.CreateCourseCPL)
			privateGroup.POST("/courses/:id/cpls/default", dosenOrAdmin, cplCtrl.GenerateDefaultCPLs)
			privateGroup.PUT("/cpls/:id", dosenOrAdmin, cplCtrl.UpdateCourseCPL)
			privateGroup.DELETE("/cpls/:id", dosenOrAdmin, cplCtrl.DeleteCourseCPL)

			// 3.2 Rekapitulasi Ketercapaian CPL Kelas & Simulasi 5 Mahasiswa OBE
			privateGroup.GET("/courses/:id/cpl-recap", cplCtrl.GetCPLRecap)
			privateGroup.POST("/courses/:id/simulate-obe", dosenOrAdmin, cplCtrl.SimulateOBE)

			// 3.3 Rancangan Butir Komponen Penilaian (RPS Asesmen) per Mata Kuliah
			privateGroup.GET("/courses/:id/assessment-items", gradeCtrl.GetCourseAssessmentItems)
			privateGroup.PUT("/courses/:id/assessment-items", dosenOrAdmin, gradeCtrl.UpdateCourseAssessmentItems)

			// 4. Data Penilaian (Grades)
			privateGroup.GET("/grades", gradeCtrl.GetGrades)
			privateGroup.GET("/grades/:id", gradeCtrl.GetGradeByID)
			// Input, edit, dan hapus nilai khusus Dosen dan Admin
			privateGroup.POST("/grades", dosenOrAdmin, gradeCtrl.CreateGrade)
			privateGroup.PUT("/grades/:id", dosenOrAdmin, gradeCtrl.UpdateGrade)
			privateGroup.DELETE("/grades/:id", dosenOrAdmin, gradeCtrl.DeleteGrade)

			// 4.1 Input Penilaian Serentak (Batch Matrix Grading)
			privateGroup.POST("/courses/:id/batch-grades", dosenOrAdmin, gradeCtrl.SaveBatchGrades)
		}
	}

	// Middleware: redirect ke /login jika user belum terautentikasi (untuk halaman HTML)
	requireAuthHTML := func(c *gin.Context) {
		token, err := c.Cookie("token")
		if err != nil || token == "" {
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}
		// Validasi token JWT
		_, err = utils.ValidateToken(token, cfg.JWTSecret)
		if err != nil {
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}
		c.Next()
	}

	// Rute halaman HTML publik (bisa diakses tanpa login)
	html := r.Group("/")
	{
		html.GET("/", func(c *gin.Context) {
			c.HTML(http.StatusOK, "index.html", gin.H{"title": "Dashboard"})
		})
		html.GET("/public", func(c *gin.Context) {
			c.HTML(http.StatusOK, "public_lookup.html", gin.H{"title": "Portal Nilai Mahasiswa"})
		})
		html.GET("/cek-nilai", func(c *gin.Context) {
			c.HTML(http.StatusOK, "public_lookup.html", gin.H{"title": "Cek Nilai & CPL Mahasiswa"})
		})
		html.GET("/lookup", func(c *gin.Context) {
			c.HTML(http.StatusOK, "public_lookup.html", gin.H{"title": "Pencarian Nilai Mahasiswa"})
		})
		html.GET("/login", redirectIfAuthenticated, func(c *gin.Context) {
			c.HTML(http.StatusOK, "login.html", gin.H{"title": "Masuk"})
		})
		html.GET("/register", redirectIfAuthenticated, func(c *gin.Context) {
			c.HTML(http.StatusOK, "register.html", gin.H{"title": "Daftar Akun"})
		})
	}

	// Rute halaman HTML yang membutuhkan autentikasi (redirect ke /login jika belum login)
	protectedHTML := r.Group("/")
	protectedHTML.Use(requireAuthHTML)
	{
		protectedHTML.GET("/students", func(c *gin.Context) {
			c.HTML(http.StatusOK, "students.html", gin.H{"title": "Data Mahasiswa"})
		})
		protectedHTML.GET("/courses", func(c *gin.Context) {
			c.HTML(http.StatusOK, "courses.html", gin.H{"title": "Data Mata Kuliah"})
		})
		protectedHTML.GET("/grades", func(c *gin.Context) {
			c.HTML(http.StatusOK, "grades.html", gin.H{"title": "Hasil & Input Nilai"})
		})
		protectedHTML.GET("/recap", func(c *gin.Context) {
			c.HTML(http.StatusOK, "recap.html", gin.H{"title": "Dashboard Rekapitulasi Nilai & CPL"})
		})
	}

	return r
}

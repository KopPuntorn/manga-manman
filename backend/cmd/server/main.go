package main

import (
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/manga-manman/backend/internal/config"
	"github.com/manga-manman/backend/internal/database"
	"github.com/manga-manman/backend/internal/handler"
	mw "github.com/manga-manman/backend/internal/middleware"
	"github.com/manga-manman/backend/internal/repository"
	"github.com/manga-manman/backend/internal/service"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	pool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Run migrations
	if err := database.Migrate(pool); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize services
	mangadexService := service.NewMangaDexService()

	// Initialize translator based on config
	var translator service.Translator
	switch cfg.MangaTranslator {
	case "gemini":
		if len(cfg.GeminiAPIKeys) == 0 {
			log.Println("⚠️  GEMINI_API_KEY not set. Translation will fail until configured.")
		} else {
			log.Printf("🤖 Gemini Translator active with %d API Key(s) in Load Balancing pool", len(cfg.GeminiAPIKeys))
		}
		translator = service.NewGeminiTranslator(cfg.GeminiAPIKeys, cfg.GeminiModel)
	case "groq":
		fallthrough
	default:
		if cfg.GroqAPIKey == "" && len(cfg.GeminiAPIKeys) > 0 {
			log.Printf("ℹ️ GROQ_API_KEY not set, using Gemini Translator with %d API Key(s)", len(cfg.GeminiAPIKeys))
			translator = service.NewGeminiTranslator(cfg.GeminiAPIKeys, cfg.GeminiModel)
		} else {
			if cfg.GroqAPIKey == "" {
				log.Println("⚠️  GROQ_API_KEY not set. Translation will fail until configured.")
			}
			translator = service.NewGroqTranslator(cfg.GroqAPIKey)
		}
	}

	// Initialize repositories
	translationRepo := repository.NewTranslationRepository(pool)
	libraryRepo := repository.NewLibraryRepository(pool)
	historyRepo := repository.NewHistoryRepository(pool)

	// Initialize handlers
	mangaHandler := handler.NewMangaHandler(mangadexService)
	chapterHandler := handler.NewChapterHandler(mangadexService)
	translationHandler := handler.NewTranslationHandler(translator, translationRepo)
	libraryHandler := handler.NewLibraryHandler(libraryRepo, historyRepo)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "MangaManman API v1",
		BodyLimit:    10 * 1024 * 1024, // 10MB
		ServerHeader: "MangaManman",
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${method} ${path} ${latency}\n",
	}))
	mw.SetupCORS(app, cfg.FrontendURL)

	// Health check
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "manga-manman-api", "translator": translator.Provider()})
	})
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "manga-manman-api", "translator": translator.Provider()})
	})

	// API routes
	api := app.Group("/api")

	// Manga & Tag routes
	api.Get("/manga/search", mangaHandler.SearchManga)
	api.Get("/manga/:id", mangaHandler.GetMangaDetail)
	api.Get("/tags", mangaHandler.GetTags)

	// Chapter routes
	api.Get("/manga/:id/chapters", chapterHandler.GetChapters)
	api.Get("/chapter/:id/pages", chapterHandler.GetChapterPages)

	// Translation routes
	api.Post("/translate", translationHandler.TranslatePage)
	api.Put("/translate/:chapterId/:pageIndex", translationHandler.UpdateTranslation)
	api.Get("/translate/:chapterId", translationHandler.GetChapterTranslations)

	// Library routes
	api.Get("/library", libraryHandler.GetLibrary)
	api.Post("/library", libraryHandler.AddToLibrary)
	api.Patch("/library/:mangaId/shelf", libraryHandler.UpdateShelf)
	api.Patch("/library/:mangaId/category", libraryHandler.UpdateShelf)
	api.Delete("/library/:mangaId", libraryHandler.RemoveFromLibrary)
	api.Get("/library/:mangaId/check", libraryHandler.CheckLibrary)

	// Reading Progress & Stats routes
	api.Get("/progress", libraryHandler.GetAllReadingProgress)
	api.Get("/progress/:mangaId", libraryHandler.GetReadingProgress)
	api.Put("/progress", libraryHandler.UpdateReadingProgress)
	api.Get("/history", libraryHandler.GetAllReadingProgress)
	api.Get("/history/:mangaId", libraryHandler.GetReadingProgress)
	api.Put("/history", libraryHandler.UpdateReadingProgress)
	api.Get("/stats", libraryHandler.GetReadingStats)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 MangaManman API starting on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

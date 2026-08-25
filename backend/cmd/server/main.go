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
	case "groq":
		if cfg.GroqAPIKey == "" {
			log.Println("⚠️  GROQ_API_KEY not set. Translation will fail until configured.")
		}
		translator = service.NewGroqTranslator(cfg.GroqAPIKey)
	default:
		log.Printf("⚠️  Unknown MANGA_TRANSLATOR '%s', defaulting to groq", cfg.MangaTranslator)
		translator = service.NewGroqTranslator(cfg.GroqAPIKey)
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
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "manga-manman-api"})
	})

	// API routes
	api := app.Group("/api")

	// Manga routes
	api.Get("/manga/search", mangaHandler.SearchManga)
	api.Get("/manga/:id", mangaHandler.GetMangaDetail)

	// Chapter routes
	api.Get("/manga/:id/chapters", chapterHandler.GetChapters)
	api.Get("/chapter/:id/pages", chapterHandler.GetChapterPages)

	// Translation routes
	api.Post("/translate", translationHandler.TranslatePage)
	api.Get("/translate/:chapterId", translationHandler.GetChapterTranslations)

	// Library routes
	api.Get("/library", libraryHandler.GetLibrary)
	api.Post("/library", libraryHandler.AddToLibrary)
	api.Delete("/library/:mangaId", libraryHandler.RemoveFromLibrary)
	api.Get("/library/:mangaId/check", libraryHandler.CheckLibrary)

	// History routes
	api.Get("/history/:mangaId", libraryHandler.GetHistory)
	api.Put("/history", libraryHandler.UpdateHistory)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 MangaManman API starting on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

package handler

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/manga-manman/backend/internal/model"
	"github.com/manga-manman/backend/internal/repository"
	"github.com/manga-manman/backend/internal/service"
)

type TranslationHandler struct {
	translator service.Translator
	repo       *repository.TranslationRepository
}

func NewTranslationHandler(translator service.Translator, repo *repository.TranslationRepository) *TranslationHandler {
	return &TranslationHandler{
		translator: translator,
		repo:       repo,
	}
}

// TranslatePage handles POST /api/translate
func (h *TranslationHandler) TranslatePage(c *fiber.Ctx) error {
	var req model.TranslateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
	}

	if req.ChapterID == "" || req.ImageURL == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "chapterId and imageUrl are required",
		})
	}

	// Check cache first
	cached, err := h.repo.GetByPage(c.Context(), req.ChapterID, req.PageIndex)
	if err == nil && cached != nil {
		log.Printf("📖 Translation cache hit: chapter=%s page=%d", req.ChapterID, req.PageIndex)
		return c.JSON(model.APIResponse{
			Success: true,
			Data:    cached,
		})
	}

	// Call translator
	log.Printf("🔄 Translating: chapter=%s page=%d", req.ChapterID, req.PageIndex)
	result, err := h.translator.TranslatePage(c.Context(), req.ImageURL)
	if err != nil {
		log.Printf("❌ Translation error: %v", err)
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   "translation failed: " + err.Error(),
		})
	}

	// Save to cache
	translation := &model.Translation{
		ChapterID: req.ChapterID,
		PageIndex: req.PageIndex,
		Result:    *result,
		Provider:  h.translator.Provider(),
	}

	if err := h.repo.Save(c.Context(), translation); err != nil {
		log.Printf("⚠️ Failed to cache translation: %v", err)
		// Still return the result even if caching failed
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    translation,
	})
}

// GetChapterTranslations handles GET /api/translate/:chapterId
func (h *TranslationHandler) GetChapterTranslations(c *fiber.Ctx) error {
	chapterID := c.Params("chapterId")
	if chapterID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "chapterId is required",
		})
	}

	translations, err := h.repo.GetByChapter(c.Context(), chapterID)
	if err != nil && err != pgx.ErrNoRows {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    translations,
	})
}

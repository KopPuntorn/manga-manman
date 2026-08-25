package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/manga-manman/backend/internal/model"
	"github.com/manga-manman/backend/internal/repository"
)

type LibraryHandler struct {
	libraryRepo *repository.LibraryRepository
	historyRepo *repository.HistoryRepository
}

func NewLibraryHandler(libraryRepo *repository.LibraryRepository, historyRepo *repository.HistoryRepository) *LibraryHandler {
	return &LibraryHandler{
		libraryRepo: libraryRepo,
		historyRepo: historyRepo,
	}
}

// GetLibrary handles GET /api/library
func (h *LibraryHandler) GetLibrary(c *fiber.Ctx) error {
	entries, err := h.libraryRepo.GetAll(c.Context())
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    entries,
	})
}

// AddToLibrary handles POST /api/library
func (h *LibraryHandler) AddToLibrary(c *fiber.Ctx) error {
	var req model.AddToLibraryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
	}

	if req.MangaID == "" || req.Title == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId and title are required",
		})
	}

	entry, err := h.libraryRepo.Add(c.Context(), req)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.Status(201).JSON(model.APIResponse{
		Success: true,
		Data:    entry,
	})
}

// RemoveFromLibrary handles DELETE /api/library/:mangaId
func (h *LibraryHandler) RemoveFromLibrary(c *fiber.Ctx) error {
	mangaID := c.Params("mangaId")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId is required",
		})
	}

	if err := h.libraryRepo.Remove(c.Context(), mangaID); err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
	})
}

// CheckLibrary handles GET /api/library/:mangaId/check
func (h *LibraryHandler) CheckLibrary(c *fiber.Ctx) error {
	mangaID := c.Params("mangaId")
	exists, err := h.libraryRepo.IsInLibrary(c.Context(), mangaID)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    fiber.Map{"inLibrary": exists},
	})
}

// GetHistory handles GET /api/history/:mangaId
func (h *LibraryHandler) GetHistory(c *fiber.Ctx) error {
	mangaID := c.Params("mangaId")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId is required",
		})
	}

	history, err := h.historyRepo.GetByManga(c.Context(), mangaID)
	if err != nil && err != pgx.ErrNoRows {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    history,
	})
}

// UpdateHistory handles PUT /api/history
func (h *LibraryHandler) UpdateHistory(c *fiber.Ctx) error {
	var req model.UpdateHistoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
	}

	if req.MangaID == "" || req.ChapterID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId and chapterId are required",
		})
	}

	if err := h.historyRepo.Upsert(c.Context(), req); err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
	})
}

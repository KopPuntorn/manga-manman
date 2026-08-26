package handler

import (
	"strconv"

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

// GetLibrary handles GET /api/library (with optional ?shelf= or ?category= filter)
func (h *LibraryHandler) GetLibrary(c *fiber.Ctx) error {
	shelf := c.Query("shelf")
	if shelf == "" {
		shelf = c.Query("category")
	}
	var entries []model.LibraryEntry
	var err error

	if shelf != "" && shelf != "all" {
		entries, err = h.libraryRepo.GetByCategory(c.Context(), shelf)
	} else {
		entries, err = h.libraryRepo.GetAll(c.Context())
	}

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

// UpdateCategory handles PATCH /api/library/:mangaId/category (or /api/library/:mangaId/shelf)
func (h *LibraryHandler) UpdateCategory(c *fiber.Ctx) error {
	mangaID := c.Params("mangaId")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId is required",
		})
	}

	var req model.UpdateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "invalid request body",
		})
	}

	targetShelf := req.Shelf
	if targetShelf == "" {
		targetShelf = req.Category
	}

	if err := h.libraryRepo.UpdateCategory(c.Context(), mangaID, targetShelf); err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data: fiber.Map{
			"mangaId":  mangaID,
			"shelf":    targetShelf,
			"category": targetShelf,
		},
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
	exists, category, err := h.libraryRepo.IsInLibrary(c.Context(), mangaID)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data: fiber.Map{
			"inLibrary": exists,
			"shelf":     category,
			"category":  category,
		},
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

// GetAllHistory handles GET /api/history
func (h *LibraryHandler) GetAllHistory(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	history, err := h.historyRepo.GetAll(c.Context(), limit)
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

// GetReadingStats handles GET /api/stats
func (h *LibraryHandler) GetReadingStats(c *fiber.Ctx) error {
	stats, err := h.historyRepo.GetStats(c.Context())
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    stats,
	})
}


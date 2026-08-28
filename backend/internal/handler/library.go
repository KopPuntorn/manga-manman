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
		entries, err = h.libraryRepo.GetByShelf(c.Context(), shelf)
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

// UpdateShelf handles PATCH /api/library/:mangaId/shelf.
// The /category route remains as a backward compatibility alias.
func (h *LibraryHandler) UpdateShelf(c *fiber.Ctx) error {
	mangaID := c.Params("mangaId")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId is required",
		})
	}

	var req model.UpdateShelfRequest
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

	if err := h.libraryRepo.UpdateShelf(c.Context(), mangaID, targetShelf); err != nil {
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
	exists, shelf, err := h.libraryRepo.IsInLibrary(c.Context(), mangaID)
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
			"shelf":     shelf,
			"category":  shelf,
		},
	})
}

// GetReadingProgress handles GET /api/progress/:mangaId.
// The /history route remains as a backward compatibility alias.
func (h *LibraryHandler) GetReadingProgress(c *fiber.Ctx) error {
	mangaID := c.Params("mangaId")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "mangaId is required",
		})
	}

	progress, err := h.historyRepo.GetByManga(c.Context(), mangaID)
	if err != nil && err != pgx.ErrNoRows {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    progress,
	})
}

// GetAllReadingProgress handles GET /api/progress.
// The /history route remains as a backward compatibility alias.
func (h *LibraryHandler) GetAllReadingProgress(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	progress, err := h.historyRepo.GetAll(c.Context(), limit)
	if err != nil && err != pgx.ErrNoRows {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    progress,
	})
}

// UpdateReadingProgress handles PUT /api/progress.
// The /history route remains as a backward compatibility alias.
func (h *LibraryHandler) UpdateReadingProgress(c *fiber.Ctx) error {
	var req model.UpdateReadingProgressRequest
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

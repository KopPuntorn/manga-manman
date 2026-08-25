package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/manga-manman/backend/internal/model"
	"github.com/manga-manman/backend/internal/service"
)

type ChapterHandler struct {
	mangadex *service.MangaDexService
}

func NewChapterHandler(mangadex *service.MangaDexService) *ChapterHandler {
	return &ChapterHandler{mangadex: mangadex}
}

// GetChapters handles GET /api/manga/:id/chapters?limit=...&offset=...&order=...
func (h *ChapterHandler) GetChapters(c *fiber.Ctx) error {
	mangaID := c.Params("id")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "manga ID is required",
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	order := c.Query("order", "asc")

	if limit > 500 {
		limit = 500
	}

	chapters, total, err := h.mangadex.GetChapterListWithOrder(mangaID, limit, offset, order)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data: fiber.Map{
			"chapters": chapters,
			"total":    total,
			"limit":    limit,
			"offset":   offset,
		},
	})
}


// GetChapterPages handles GET /api/chapter/:id/pages
func (h *ChapterHandler) GetChapterPages(c *fiber.Ctx) error {
	chapterID := c.Params("id")
	if chapterID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "chapter ID is required",
		})
	}

	pages, err := h.mangadex.GetChapterPages(chapterID)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    pages,
	})
}

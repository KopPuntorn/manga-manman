package handler

import (
	"strconv"
	"strings"

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
	langQuery := c.Query("languages", c.Query("lang"))

	var languages []string
	if langQuery != "" {
		for _, l := range strings.Split(langQuery, ",") {
			if trimmed := strings.TrimSpace(l); trimmed != "" {
				languages = append(languages, trimmed)
			}
		}
	}

	if limit > 500 {
		limit = 500
	}

	chapters, total, err := h.mangadex.GetChapterListWithFilters(mangaID, limit, offset, order, languages)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	c.Set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
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

	c.Set("Cache-Control", "public, max-age=120, stale-while-revalidate=300")
	return c.JSON(model.APIResponse{
		Success: true,
		Data:    pages,
	})
}

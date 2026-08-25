package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/manga-manman/backend/internal/model"
	"github.com/manga-manman/backend/internal/service"
)

type MangaHandler struct {
	mangadex *service.MangaDexService
}

func NewMangaHandler(mangadex *service.MangaDexService) *MangaHandler {
	return &MangaHandler{mangadex: mangadex}
}

// SearchManga handles GET /api/manga/search?q=...&limit=...&offset=...
func (h *MangaHandler) SearchManga(c *fiber.Ctx) error {
	query := c.Query("q")
	if query == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "query parameter 'q' is required",
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	results, total, err := h.mangadex.SearchManga(query, limit, offset)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data: fiber.Map{
			"results": results,
			"total":   total,
			"limit":   limit,
			"offset":  offset,
		},
	})
}

// GetMangaDetail handles GET /api/manga/:id
func (h *MangaHandler) GetMangaDetail(c *fiber.Ctx) error {
	mangaID := c.Params("id")
	if mangaID == "" {
		return c.Status(400).JSON(model.APIResponse{
			Success: false,
			Error:   "manga ID is required",
		})
	}

	detail, err := h.mangadex.GetMangaDetail(mangaID)
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    detail,
	})
}

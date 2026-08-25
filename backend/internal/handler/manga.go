package handler

import (
	"strconv"
	"strings"

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

// SearchManga handles GET /api/manga/search?q=...&tags=...&status=...&sortBy=...&contentRating=...&limit=...&offset=...
func (h *MangaHandler) SearchManga(c *fiber.Ctx) error {
	query := c.Query("q")
	tagsQuery := c.Query("tags")
	status := c.Query("status")
	sortBy := c.Query("sortBy")
	contentRatingQuery := c.Query("contentRating")

	var tags []string
	if tagsQuery != "" {
		for _, t := range strings.Split(tagsQuery, ",") {
			if trimmed := strings.TrimSpace(t); trimmed != "" {
				tags = append(tags, trimmed)
			}
		}
	}

	var contentRating []string
	if contentRatingQuery != "" {
		for _, cr := range strings.Split(contentRatingQuery, ",") {
			if trimmed := strings.TrimSpace(cr); trimmed != "" {
				contentRating = append(contentRating, trimmed)
			}
		}
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	if limit > 100 {
		limit = 100
	}
	if limit <= 0 {
		limit = 20
	}

	filters := model.MangaSearchFilters{
		Query:         query,
		Tags:          tags,
		Status:        status,
		SortBy:        sortBy,
		ContentRating: contentRating,
		Limit:         limit,
		Offset:        offset,
	}

	results, total, err := h.mangadex.SearchMangaFiltered(filters)
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

// GetTags handles GET /api/tags
func (h *MangaHandler) GetTags(c *fiber.Ctx) error {
	tags, err := h.mangadex.GetTags()
	if err != nil {
		return c.Status(500).JSON(model.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
	}

	return c.JSON(model.APIResponse{
		Success: true,
		Data:    tags,
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


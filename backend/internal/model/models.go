package model

import "time"

// --- MangaDex DTOs ---

type MangaSearchResult struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	CoverURL    string   `json:"coverUrl"`
	Author      string   `json:"author"`
	Artist      string   `json:"artist"`
	Status      string   `json:"status"`
	Year        int      `json:"year,omitempty"`
	Tags        []string `json:"tags"`
}

type MangaTag struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Group string `json:"group"`
}

type MangaSearchFilters struct {
	Query         string   `json:"query"`
	Tags          []string `json:"tags,omitempty"`
	Status        string   `json:"status,omitempty"`
	SortBy        string   `json:"sortBy,omitempty"`        // relevance, latest, rating, followedCount
	ContentRating []string `json:"contentRating,omitempty"` // safe, suggestive, erotica
	Limit         int      `json:"limit"`
	Offset        int      `json:"offset"`
}

type MangaDetail struct {
	ID               string   `json:"id"`
	Title            string   `json:"title"`
	AltTitles        []string `json:"altTitles,omitempty"`
	Description      string   `json:"description"`
	CoverURL         string   `json:"coverUrl"`
	Author           string   `json:"author"`
	Artist           string   `json:"artist"`
	Status           string   `json:"status"`
	Year             int      `json:"year,omitempty"`
	Tags             []string `json:"tags"`
	ContentRating    string   `json:"contentRating"`
	OriginalLanguage string   `json:"originalLanguage"`
}

type Chapter struct {
	ID              string `json:"id"`
	Chapter         string `json:"chapter"`
	Title           string `json:"title"`
	Volume          string `json:"volume,omitempty"`
	Pages           int    `json:"pages"`
	Language        string `json:"language"`
	ScanlationGroup string `json:"scanlationGroup,omitempty"`
	PublishedAt     string `json:"publishedAt"`
}

type ChapterPages struct {
	ChapterID  string   `json:"chapterId"`
	Pages      []string `json:"pages"`
	PagesSaver []string `json:"pagesSaver"`
}

// --- Translation ---

type TextBlock struct {
	Original string  `json:"original"`
	Thai     string  `json:"thai"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
}

type TranslationResult struct {
	Texts []TextBlock `json:"texts"`
}

type Translation struct {
	ID        int               `json:"id"`
	ChapterID string            `json:"chapterId"`
	PageIndex int               `json:"pageIndex"`
	ImageHash string            `json:"imageHash,omitempty"`
	Result    TranslationResult `json:"result"`
	Provider  string            `json:"provider"`
	CreatedAt time.Time         `json:"createdAt"`
}

type TranslateRequest struct {
	ChapterID string `json:"chapterId"`
	PageIndex int    `json:"pageIndex"`
	ImageURL  string `json:"imageUrl"`
}

type UpdateTranslationRequest struct {
	Texts []TextBlock `json:"texts"`
}

// --- Library ---

type LibraryEntry struct {
	ID       int       `json:"id"`
	MangaID  string    `json:"mangaId"`
	Title    string    `json:"title"`
	CoverURL string    `json:"coverUrl"`
	Category string    `json:"category"` // reading, plan_to_read, completed, dropped
	AddedAt  time.Time `json:"addedAt"`
}

type AddToLibraryRequest struct {
	MangaID  string `json:"mangaId"`
	Title    string `json:"title"`
	CoverURL string `json:"coverUrl"`
	Category string `json:"category,omitempty"`
}

type UpdateCategoryRequest struct {
	Category string `json:"category"`
}

// --- Reading History ---

type ReadingHistory struct {
	ID        int       `json:"id"`
	MangaID   string    `json:"mangaId"`
	ChapterID string    `json:"chapterId"`
	PageIndex int       `json:"pageIndex"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type UpdateHistoryRequest struct {
	MangaID   string `json:"mangaId"`
	ChapterID string `json:"chapterId"`
	PageIndex int    `json:"pageIndex"`
}

// --- API Response ---

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}


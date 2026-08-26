package model

import "time"

// --- Manga & Tag DTOs (Sourced from MangaDex) ---

// MangaSearchResult represents a Manga item returned by source search.
type MangaSearchResult struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	CoverURL    string   `json:"coverUrl"`
	Author      string   `json:"author"`
	Artist      string   `json:"artist"`
	Status      string   `json:"status"` // Manga Status: ongoing, completed
	Year        int      `json:"year,omitempty"`
	Tags        []string `json:"tags"`
}

// MangaTag represents a source-provided Tag describing a Manga.
type MangaTag struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Group string `json:"group"`
}

// MangaSearchFilters parameters for searching Manga.
type MangaSearchFilters struct {
	Query         string   `json:"query"`
	Tags          []string `json:"tags,omitempty"`
	Status        string   `json:"status,omitempty"`        // Manga Status: ongoing, completed
	SortBy        string   `json:"sortBy,omitempty"`        // relevance, latest, rating, followedCount
	ContentRating []string `json:"contentRating,omitempty"` // Content Rating: safe, suggestive, erotica, pornographic
	Limit         int      `json:"limit"`
	Offset        int      `json:"offset"`
}

// MangaDetail represents the detailed information of a Manga.
type MangaDetail struct {
	ID               string   `json:"id"`
	Title            string   `json:"title"`
	AltTitles        []string `json:"altTitles,omitempty"`
	Description      string   `json:"description"`
	CoverURL         string   `json:"coverUrl"`
	Author           string   `json:"author"`
	Artist           string   `json:"artist"`
	Status           string   `json:"status"` // Manga Status
	Year             int      `json:"year,omitempty"`
	Tags             []string `json:"tags"`
	ContentRating    string   `json:"contentRating"`
	OriginalLanguage string   `json:"originalLanguage"`
}

// Chapter represents a readable MangaDex chapter release for a Manga.
type Chapter struct {
	ID              string `json:"id"`
	Chapter         string `json:"chapter"` // Chapter Number, e.g. "12" or "12.5"
	Title           string `json:"title"`
	Volume          string `json:"volume,omitempty"`
	Pages           int    `json:"pages"`
	Language        string `json:"language"` // Chapter Language
	ScanlationGroup string `json:"scanlationGroup,omitempty"`
	PublishedAt     string `json:"publishedAt"`
}

// ChapterPages represents the page image list for a Chapter.
type ChapterPages struct {
	ChapterID  string   `json:"chapterId"`
	Pages      []string `json:"pages"`
	PagesSaver []string `json:"pagesSaver"`
}

// --- Translation Domain Models ---

// TextBlock represents a bounded area of text on a manga page (dialogue, narration, signs, etc.).
type TextBlock struct {
	Original string  `json:"original"` // Source Text detected from image
	Thai     string  `json:"thai"`     // Translation in Thai (Target Language)
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
}

// TranslationResult represents the collection of Text Blocks on one Page.
type TranslationResult struct {
	Texts []TextBlock `json:"texts"`
}

// Translation represents the Thai translation for one Page.
type Translation struct {
	ID        int               `json:"id"`
	ChapterID string            `json:"chapterId"`
	PageIndex int               `json:"pageIndex"`
	ImageHash string            `json:"imageHash,omitempty"`
	Result    TranslationResult `json:"result"`
	Provider  string            `json:"provider"`
	CreatedAt time.Time         `json:"createdAt"`
}

// TranslateRequest initiates a Generated Translation request.
type TranslateRequest struct {
	ChapterID string `json:"chapterId"`
	PageIndex int    `json:"pageIndex"`
	ImageURL  string `json:"imageUrl"`
}

// UpdateTranslationRequest represents a Translation Correction submitted by a Reader.
type UpdateTranslationRequest struct {
	Texts []TextBlock `json:"texts"`
}

// --- Library Domain Models ---

// LibraryEntry represents a manga intentionally saved to a Reader's personal library.
type LibraryEntry struct {
	ID       int       `json:"id"`
	MangaID  string    `json:"mangaId"`
	Title    string    `json:"title"`
	CoverURL string    `json:"coverUrl"`
	Category string    `json:"category"`        // Backwards compatibility alias for Shelf
	Shelf    string    `json:"shelf,omitempty"` // Library Shelf: reading, plan_to_read, completed, dropped
	AddedAt  time.Time `json:"addedAt"`
}

// AddToLibraryRequest payload to create a new Library Entry.
type AddToLibraryRequest struct {
	MangaID  string `json:"mangaId"`
	Title    string `json:"title"`
	CoverURL string `json:"coverUrl"`
	Category string `json:"category,omitempty"`
	Shelf    string `json:"shelf,omitempty"`
}

// UpdateShelfRequest payload to update the Library Shelf for a Library Entry.
type UpdateCategoryRequest struct {
	Category string `json:"category,omitempty"`
	Shelf    string `json:"shelf,omitempty"`
}

// UpdateShelfRequest is an alias for UpdateCategoryRequest.
type UpdateShelfRequest = UpdateCategoryRequest

// --- Reading Progress Domain Models ---

// ReadingProgress represents the Reader's latest known position within a Manga.
type ReadingProgress struct {
	ID        int       `json:"id"`
	MangaID   string    `json:"mangaId"`
	ChapterID string    `json:"chapterId"`
	PageIndex int       `json:"pageIndex"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ReadingHistory is an alias for ReadingProgress for backward compatibility.
type ReadingHistory = ReadingProgress

// GlobalReadingProgressEntry represents a resume entry for the Reader with Manga details.
type GlobalReadingProgressEntry struct {
	ID        int       `json:"id"`
	MangaID   string    `json:"mangaId"`
	ChapterID string    `json:"chapterId"`
	PageIndex int       `json:"pageIndex"`
	UpdatedAt time.Time `json:"updatedAt"`
	Title     string    `json:"title,omitempty"`
	CoverURL  string    `json:"coverUrl,omitempty"`
}

// GlobalHistoryEntry is an alias for GlobalReadingProgressEntry for backward compatibility.
type GlobalHistoryEntry = GlobalReadingProgressEntry

// ReadingStats contains library and progress metrics for the Reader.
type ReadingStats struct {
	TotalChaptersRead   int            `json:"totalChaptersRead"`
	TotalLibraryEntries int            `json:"totalLibraryEntries"`
	TotalBookmarked     int            `json:"totalBookmarked"` // Backward compatibility alias
	ShelvesCount        map[string]int `json:"shelvesCount"`
	CategoriesCount     map[string]int `json:"categoriesCount"` // Backward compatibility alias
}

// UpdateReadingProgressRequest payload to record reading position.
type UpdateReadingProgressRequest struct {
	MangaID   string `json:"mangaId"`
	ChapterID string `json:"chapterId"`
	PageIndex int    `json:"pageIndex"`
}

// UpdateHistoryRequest is an alias for UpdateReadingProgressRequest.
type UpdateHistoryRequest = UpdateReadingProgressRequest

// --- API Response ---

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}



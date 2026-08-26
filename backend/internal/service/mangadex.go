package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/manga-manman/backend/internal/model"
)

const (
	mangadexBaseURL = "https://api.mangadex.org"
	atHomeBaseURL   = "https://api.mangadex.org/at-home/server"
)

type MangaDexService struct {
	client *http.Client
}

func NewMangaDexService() *MangaDexService {
	return &MangaDexService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// --- MangaDex API Response Types ---

type mdResponse struct {
	Result   string          `json:"result"`
	Response string          `json:"response"`
	Data     json.RawMessage `json:"data"`
	Total    int             `json:"total,omitempty"`
	Limit    int             `json:"limit,omitempty"`
	Offset   int             `json:"offset,omitempty"`
}

type mdManga struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Attributes struct {
		Title              map[string]string            `json:"title"`
		AltTitles          []map[string]string          `json:"altTitles"`
		Description        map[string]string            `json:"description"`
		Status             string                       `json:"status"`
		Year               int                          `json:"year"`
		ContentRating      string                       `json:"contentRating"`
		OriginalLanguage   string                       `json:"originalLanguage"`
		Tags               []struct {
			Attributes struct {
				Name map[string]string `json:"name"`
			} `json:"attributes"`
		} `json:"tags"`
	} `json:"attributes"`
	Relationships []mdRelationship `json:"relationships"`
}

type mdRelationship struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	Attributes json.RawMessage `json:"attributes,omitempty"`
}

type mdChapter struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	Attributes struct {
		Chapter     string `json:"chapter"`
		Title       string `json:"title"`
		Volume      string `json:"volume"`
		Pages       int    `json:"pages"`
		TranslatedLanguage string `json:"translatedLanguage"`
		PublishAt   string `json:"publishAt"`
	} `json:"attributes"`
	Relationships []mdRelationship `json:"relationships"`
}

type mdAtHomeResponse struct {
	BaseURL string `json:"baseUrl"`
	Chapter struct {
		Hash      string   `json:"hash"`
		Data      []string `json:"data"`
		DataSaver []string `json:"dataSaver"`
	} `json:"chapter"`
}

// --- Public Methods ---

func (s *MangaDexService) SearchManga(query string, limit, offset int) ([]model.MangaSearchResult, int, error) {
	return s.SearchMangaFiltered(model.MangaSearchFilters{
		Query:  query,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *MangaDexService) SearchMangaFiltered(filters model.MangaSearchFilters) ([]model.MangaSearchResult, int, error) {
	limit := filters.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := filters.Offset
	if offset < 0 {
		offset = 0
	}

	params := url.Values{}
	if filters.Query != "" {
		params.Set("title", filters.Query)
	}
	params.Set("limit", fmt.Sprintf("%d", limit))
	params.Set("offset", fmt.Sprintf("%d", offset))
	params.Add("includes[]", "cover_art")
	params.Add("includes[]", "author")
	params.Add("includes[]", "artist")

	for _, tagID := range filters.Tags {
		if tagID != "" {
			params.Add("includedTags[]", tagID)
		}
	}

	if filters.Status != "" {
		params.Add("status[]", filters.Status)
	}

	// Sort order
	switch filters.SortBy {
	case "latest":
		params.Set("order[latestUploadedChapter]", "desc")
	case "rating":
		params.Set("order[rating]", "desc")
	case "followedCount":
		params.Set("order[followedCount]", "desc")
	case "title":
		params.Set("order[title]", "asc")
	default:
		if filters.Query != "" {
			params.Set("order[relevance]", "desc")
		} else {
			params.Set("order[followedCount]", "desc")
		}
	}

	if len(filters.ContentRating) > 0 {
		for _, cr := range filters.ContentRating {
			params.Add("contentRating[]", cr)
		}
	} else {
		params.Add("contentRating[]", "safe")
		params.Add("contentRating[]", "suggestive")
		params.Add("contentRating[]", "erotica")
		params.Add("contentRating[]", "pornographic")
	}

	reqURL := fmt.Sprintf("%s/manga?%s", mangadexBaseURL, params.Encode())
	body, err := s.doGet(reqURL)
	if err != nil {
		return nil, 0, err
	}

	var resp mdResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, 0, fmt.Errorf("unmarshal manga search: %w", err)
	}

	var mangaList []mdManga
	if err := json.Unmarshal(resp.Data, &mangaList); err != nil {
		return nil, 0, fmt.Errorf("unmarshal manga list: %w", err)
	}

	results := make([]model.MangaSearchResult, 0, len(mangaList))
	for _, m := range mangaList {
		results = append(results, s.toMangaSearchResult(m))
	}

	return results, resp.Total, nil
}

func (s *MangaDexService) GetTags() ([]model.MangaTag, error) {
	reqURL := fmt.Sprintf("%s/manga/tag", mangadexBaseURL)
	body, err := s.doGet(reqURL)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result string `json:"result"`
		Data   []struct {
			ID         string `json:"id"`
			Attributes struct {
				Name  map[string]string `json:"name"`
				Group string            `json:"group"`
			} `json:"attributes"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal tags: %w", err)
	}

	tags := make([]model.MangaTag, 0, len(resp.Data))
	for _, item := range resp.Data {
		name := extractLocalized(item.Attributes.Name, "en")
		if name != "" {
			tags = append(tags, model.MangaTag{
				ID:    item.ID,
				Name:  name,
				Group: item.Attributes.Group,
			})
		}
	}

	return tags, nil
}

func (s *MangaDexService) GetMangaDetail(mangaID string) (*model.MangaDetail, error) {
	params := url.Values{}
	params.Add("includes[]", "cover_art")
	params.Add("includes[]", "author")
	params.Add("includes[]", "artist")

	reqURL := fmt.Sprintf("%s/manga/%s?%s", mangadexBaseURL, mangaID, params.Encode())
	body, err := s.doGet(reqURL)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Result string  `json:"result"`
		Data   mdManga `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal manga detail: %w", err)
	}

	detail := s.toMangaDetail(resp.Data)
	return &detail, nil
}

func (s *MangaDexService) GetChapterList(mangaID string, limit, offset int) ([]model.Chapter, int, error) {
	return s.GetChapterListWithFilters(mangaID, limit, offset, "asc", nil)
}

func (s *MangaDexService) GetChapterListWithOrder(mangaID string, limit, offset int, order string) ([]model.Chapter, int, error) {
	return s.GetChapterListWithFilters(mangaID, limit, offset, order, nil)
}

func (s *MangaDexService) GetChapterListWithFilters(mangaID string, limit, offset int, order string, languages []string) ([]model.Chapter, int, error) {
	if order != "desc" {
		order = "asc"
	}
	if limit <= 0 {
		limit = 500
	}
	if len(languages) == 0 {
		languages = []string{"en", "ja", "th"}
	}

	// MangaDex API allows max limit=100 per call. We paginate in batches of 100 up to requested limit.
	var allChapters []model.Chapter
	totalChapters := 0
	seenChapterNums := make(map[string]bool)

	currentOffset := offset
	targetFetch := limit

	for len(allChapters) < targetFetch {
		batchLimit := 100
		if targetFetch-len(allChapters) < 100 {
			batchLimit = targetFetch - len(allChapters)
		}

		params := url.Values{}
		params.Set("limit", fmt.Sprintf("%d", batchLimit))
		params.Set("offset", fmt.Sprintf("%d", currentOffset))
		for _, lang := range languages {
			params.Add("translatedLanguage[]", lang)
		}
		params.Add("contentRating[]", "safe")
		params.Add("contentRating[]", "suggestive")
		params.Add("contentRating[]", "erotica")
		params.Add("contentRating[]", "pornographic")
		params.Set("order[chapter]", order)
		params.Add("includes[]", "scanlation_group")


		reqURL := fmt.Sprintf("%s/manga/%s/feed?%s", mangadexBaseURL, mangaID, params.Encode())
		body, err := s.doGet(reqURL)
		if err != nil {
			if len(allChapters) > 0 {
				break
			}
			return nil, 0, err
		}

		var resp mdResponse
		if err := json.Unmarshal(body, &resp); err != nil {
			if len(allChapters) > 0 {
				break
			}
			return nil, 0, fmt.Errorf("unmarshal chapter feed: %w", err)
		}

		totalChapters = resp.Total

		var rawChapters []mdChapter
		if err := json.Unmarshal(resp.Data, &rawChapters); err != nil {
			if len(allChapters) > 0 {
				break
			}
			return nil, 0, fmt.Errorf("unmarshal chapters: %w", err)
		}

		if len(rawChapters) == 0 {
			break
		}

		for _, ch := range rawChapters {
			parsed := s.toChapter(ch)
			// Skip external dummy chapters that have 0 pages (e.g. MangaPlus promo stubs)
			if parsed.Pages <= 0 {
				continue
			}
			// Deduplicate chapter entries with the same chapter number and language
			key := fmt.Sprintf("%s_%s", parsed.Chapter, parsed.Language)
			if !seenChapterNums[key] {
				seenChapterNums[key] = true
				allChapters = append(allChapters, parsed)
			}
		}


		currentOffset += len(rawChapters)
		if currentOffset >= resp.Total {
			break
		}
	}

	return allChapters, totalChapters, nil
}



func (s *MangaDexService) GetChapterPages(chapterID string) (*model.ChapterPages, error) {
	reqURL := fmt.Sprintf("%s/%s", atHomeBaseURL, chapterID)
	body, err := s.doGet(reqURL)
	if err != nil {
		return nil, err
	}

	var atHome mdAtHomeResponse
	if err := json.Unmarshal(body, &atHome); err != nil {
		return nil, fmt.Errorf("unmarshal at-home: %w", err)
	}

	if len(atHome.Chapter.Data) == 0 {
		return nil, fmt.Errorf("ตอนนี้ไม่มีไฟล์รูปภาพบน MangaDex (เป็นลิงก์ภายนอกของ MangaPlus / สำนักพิมพ์)")
	}

	pages := make([]string, len(atHome.Chapter.Data))
	for i, filename := range atHome.Chapter.Data {
		pages[i] = fmt.Sprintf("%s/data/%s/%s", atHome.BaseURL, atHome.Chapter.Hash, filename)
	}

	pagesSaver := make([]string, len(atHome.Chapter.DataSaver))
	for i, filename := range atHome.Chapter.DataSaver {
		pagesSaver[i] = fmt.Sprintf("%s/data-saver/%s/%s", atHome.BaseURL, atHome.Chapter.Hash, filename)
	}

	return &model.ChapterPages{
		ChapterID:  chapterID,
		Pages:      pages,
		PagesSaver: pagesSaver,
	}, nil
}

// --- Private helpers ---

func (s *MangaDexService) doGet(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "MangaManman/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("MangaDex API returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return io.ReadAll(resp.Body)
}

func (s *MangaDexService) toMangaSearchResult(m mdManga) model.MangaSearchResult {
	title := extractTitle(m.Attributes.Title)
	desc := extractLocalized(m.Attributes.Description, "en")
	coverURL := s.extractCoverURL(m.ID, m.Relationships)
	author, artist := s.extractPeople(m.Relationships)
	tags := s.extractTags(m)

	return model.MangaSearchResult{
		ID:          m.ID,
		Title:       title,
		Description: desc,
		CoverURL:    coverURL,
		Author:      author,
		Artist:      artist,
		Status:      m.Attributes.Status,
		Year:        m.Attributes.Year,
		Tags:        tags,
	}
}

func (s *MangaDexService) toMangaDetail(m mdManga) model.MangaDetail {
	title := extractTitle(m.Attributes.Title)
	desc := extractLocalized(m.Attributes.Description, "en")
	coverURL := s.extractCoverURL(m.ID, m.Relationships)
	author, artist := s.extractPeople(m.Relationships)
	tags := s.extractTags(m)

	altTitles := make([]string, 0)
	for _, at := range m.Attributes.AltTitles {
		for _, v := range at {
			if v != "" && v != title {
				altTitles = append(altTitles, v)
			}
		}
	}

	return model.MangaDetail{
		ID:               m.ID,
		Title:            title,
		AltTitles:        altTitles,
		Description:      desc,
		CoverURL:         coverURL,
		Author:           author,
		Artist:           artist,
		Status:           m.Attributes.Status,
		Year:             m.Attributes.Year,
		Tags:             tags,
		ContentRating:    m.Attributes.ContentRating,
		OriginalLanguage: m.Attributes.OriginalLanguage,
	}
}

func (s *MangaDexService) toChapter(ch mdChapter) model.Chapter {
	group := ""
	for _, rel := range ch.Relationships {
		if rel.Type == "scanlation_group" && rel.Attributes != nil {
			var attrs struct {
				Name string `json:"name"`
			}
			if json.Unmarshal(rel.Attributes, &attrs) == nil {
				group = attrs.Name
			}
		}
	}

	return model.Chapter{
		ID:              ch.ID,
		Chapter:         ch.Attributes.Chapter,
		Title:           ch.Attributes.Title,
		Volume:          ch.Attributes.Volume,
		Pages:           ch.Attributes.Pages,
		Language:        ch.Attributes.TranslatedLanguage,
		ScanlationGroup: group,
		PublishedAt:     ch.Attributes.PublishAt,
	}
}

func (s *MangaDexService) extractCoverURL(mangaID string, rels []mdRelationship) string {
	// Known MangaDex placeholder cover art replacements for popular series
	knownCovers := map[string]string{
		// Solo Leveling (Na Honjaman Level-Up) official Web cover (Sung Jin-woo)
		"32d76d19-8a05-4db0-9fc2-e0b0648fe9d0": "7c21cc6b-df69-4880-a185-53a3f7a2f81d.jpg",
	}

	if customFileName, ok := knownCovers[mangaID]; ok {
		return fmt.Sprintf("https://uploads.mangadex.org/covers/%s/%s.256.jpg", mangaID, customFileName)
	}

	for _, rel := range rels {
		if rel.Type == "cover_art" && rel.Attributes != nil {
			var attrs struct {
				FileName string `json:"fileName"`
			}
			if json.Unmarshal(rel.Attributes, &attrs) == nil && attrs.FileName != "" {
				if attrs.FileName == "e90bdc47-c8b9-4df7-b2c0-17641b645ee1.jpg" {
					if alt, ok := knownCovers[mangaID]; ok {
						return fmt.Sprintf("https://uploads.mangadex.org/covers/%s/%s.256.jpg", mangaID, alt)
					}
				}
				return fmt.Sprintf("https://uploads.mangadex.org/covers/%s/%s.256.jpg", mangaID, attrs.FileName)
			}
		}
	}
	return ""
}

func (s *MangaDexService) extractPeople(rels []mdRelationship) (author, artist string) {
	for _, rel := range rels {
		if rel.Attributes == nil {
			continue
		}
		var attrs struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(rel.Attributes, &attrs) != nil {
			continue
		}
		if rel.Type == "author" && author == "" {
			author = attrs.Name
		}
		if rel.Type == "artist" && artist == "" {
			artist = attrs.Name
		}
	}
	return
}

func (s *MangaDexService) extractTags(m mdManga) []string {
	tags := make([]string, 0)
	for _, tag := range m.Attributes.Tags {
		name := extractLocalized(tag.Attributes.Name, "en")
		if name != "" {
			tags = append(tags, name)
		}
	}
	return tags
}

func extractTitle(titles map[string]string) string {
	// Prefer English, then Japanese romanized, then any
	for _, lang := range []string{"en", "ja-ro", "ja"} {
		if t, ok := titles[lang]; ok && t != "" {
			return t
		}
	}
	for _, t := range titles {
		return t
	}
	return "Unknown"
}

func extractLocalized(m map[string]string, preferredLang string) string {
	if v, ok := m[preferredLang]; ok {
		return v
	}
	// Fallback: try any English variant
	for k, v := range m {
		if strings.HasPrefix(k, "en") {
			return v
		}
	}
	for _, v := range m {
		return v
	}
	return ""
}

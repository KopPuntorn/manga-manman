package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/manga-manman/backend/internal/model"
)

type HistoryRepository struct {
	pool *pgxpool.Pool
}

func NewHistoryRepository(pool *pgxpool.Pool) *HistoryRepository {
	return &HistoryRepository{pool: pool}
}

func (r *HistoryRepository) GetByManga(ctx context.Context, mangaID string) ([]model.ReadingHistory, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manga_id, chapter_id, page_index, updated_at
		 FROM reading_history WHERE manga_id = $1 ORDER BY updated_at DESC`,
		mangaID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []model.ReadingHistory
	for rows.Next() {
		var h model.ReadingHistory
		if err := rows.Scan(&h.ID, &h.MangaID, &h.ChapterID, &h.PageIndex, &h.UpdatedAt); err != nil {
			return nil, err
		}
		history = append(history, h)
	}

	if history == nil {
		history = []model.ReadingHistory{}
	}
	return history, nil
}

func (r *HistoryRepository) Upsert(ctx context.Context, req model.UpdateHistoryRequest) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO reading_history (manga_id, chapter_id, page_index)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (manga_id, chapter_id)
		 DO UPDATE SET page_index = $3, updated_at = NOW()`,
		req.MangaID, req.ChapterID, req.PageIndex,
	)
	return err
}

func (r *HistoryRepository) GetAll(ctx context.Context, limit int) ([]model.GlobalHistoryEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx,
		`SELECT h.id, h.manga_id, h.chapter_id, h.page_index, h.updated_at,
		        COALESCE(l.title, '') as title, COALESCE(l.cover_url, '') as cover_url
		 FROM reading_history h
		 LEFT JOIN library l ON h.manga_id = l.manga_id
		 ORDER BY h.updated_at DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []model.GlobalHistoryEntry
	for rows.Next() {
		var h model.GlobalHistoryEntry
		if err := rows.Scan(&h.ID, &h.MangaID, &h.ChapterID, &h.PageIndex, &h.UpdatedAt, &h.Title, &h.CoverURL); err != nil {
			return nil, err
		}
		history = append(history, h)
	}

	if history == nil {
		history = []model.GlobalHistoryEntry{}
	}
	return history, nil
}

func (r *HistoryRepository) GetStats(ctx context.Context) (*model.ReadingStats, error) {
	var totalRead int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM reading_history`).Scan(&totalRead)
	if err != nil {
		totalRead = 0
	}

	var totalBookmarked int
	err = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM library`).Scan(&totalBookmarked)
	if err != nil {
		totalBookmarked = 0
	}

	categoriesCount := make(map[string]int)
	rows, err := r.pool.Query(ctx, `SELECT category, COUNT(*) FROM library GROUP BY category`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat string
			var count int
			if err := rows.Scan(&cat, &count); err == nil {
				categoriesCount[cat] = count
			}
		}
	}

	return &model.ReadingStats{
		TotalChaptersRead:   totalRead,
		TotalLibraryEntries: totalBookmarked,
		TotalBookmarked:     totalBookmarked,
		ShelvesCount:        categoriesCount,
		CategoriesCount:     categoriesCount,
	}, nil
}


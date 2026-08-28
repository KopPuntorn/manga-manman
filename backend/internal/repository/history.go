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

func (r *HistoryRepository) GetByManga(ctx context.Context, mangaID string) ([]model.ReadingProgress, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manga_id, chapter_id, page_index, updated_at
		 FROM reading_history WHERE manga_id = $1 ORDER BY updated_at DESC`,
		mangaID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var progress []model.ReadingProgress
	for rows.Next() {
		var h model.ReadingProgress
		if err := rows.Scan(&h.ID, &h.MangaID, &h.ChapterID, &h.PageIndex, &h.UpdatedAt); err != nil {
			return nil, err
		}
		progress = append(progress, h)
	}

	if progress == nil {
		progress = []model.ReadingProgress{}
	}
	return progress, nil
}

func (r *HistoryRepository) Upsert(ctx context.Context, req model.UpdateReadingProgressRequest) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO reading_history (manga_id, chapter_id, page_index)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (manga_id, chapter_id)
		 DO UPDATE SET page_index = $3, updated_at = NOW()`,
		req.MangaID, req.ChapterID, req.PageIndex,
	)
	return err
}

func (r *HistoryRepository) GetAll(ctx context.Context, limit int) ([]model.GlobalReadingProgressEntry, error) {
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

	var progress []model.GlobalReadingProgressEntry
	for rows.Next() {
		var h model.GlobalReadingProgressEntry
		if err := rows.Scan(&h.ID, &h.MangaID, &h.ChapterID, &h.PageIndex, &h.UpdatedAt, &h.Title, &h.CoverURL); err != nil {
			return nil, err
		}
		progress = append(progress, h)
	}

	if progress == nil {
		progress = []model.GlobalReadingProgressEntry{}
	}
	return progress, nil
}

func (r *HistoryRepository) GetStats(ctx context.Context) (*model.ReadingStats, error) {
	var totalRead int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM reading_history`).Scan(&totalRead)
	if err != nil {
		totalRead = 0
	}

	var totalLibraryEntries int
	err = r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM library`).Scan(&totalLibraryEntries)
	if err != nil {
		totalLibraryEntries = 0
	}

	shelvesCount := make(map[string]int)
	rows, err := r.pool.Query(ctx, `SELECT category, COUNT(*) FROM library GROUP BY category`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var shelf string
			var count int
			if err := rows.Scan(&shelf, &count); err == nil {
				shelvesCount[shelf] = count
			}
		}
	}

	return &model.ReadingStats{
		TotalChaptersRead:   totalRead,
		TotalLibraryEntries: totalLibraryEntries,
		TotalBookmarked:     totalLibraryEntries,
		ShelvesCount:        shelvesCount,
		CategoriesCount:     shelvesCount,
	}, nil
}

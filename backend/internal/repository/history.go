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

func (r *HistoryRepository) GetLatest(ctx context.Context, mangaID string) (*model.ReadingHistory, error) {
	var h model.ReadingHistory
	err := r.pool.QueryRow(ctx,
		`SELECT id, manga_id, chapter_id, page_index, updated_at
		 FROM reading_history WHERE manga_id = $1 ORDER BY updated_at DESC LIMIT 1`,
		mangaID,
	).Scan(&h.ID, &h.MangaID, &h.ChapterID, &h.PageIndex, &h.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &h, nil
}

package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/manga-manman/backend/internal/model"
)

type TranslationRepository struct {
	pool *pgxpool.Pool
}

func NewTranslationRepository(pool *pgxpool.Pool) *TranslationRepository {
	return &TranslationRepository{pool: pool}
}

func (r *TranslationRepository) GetByPage(ctx context.Context, chapterID string, pageIndex int) (*model.Translation, error) {
	var t model.Translation
	var resultJSON []byte

	err := r.pool.QueryRow(ctx,
		`SELECT id, chapter_id, page_index, image_hash, result, provider, created_at
		 FROM translations WHERE chapter_id = $1 AND page_index = $2`,
		chapterID, pageIndex,
	).Scan(&t.ID, &t.ChapterID, &t.PageIndex, &t.ImageHash, &resultJSON, &t.Provider, &t.CreatedAt)

	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(resultJSON, &t.Result); err != nil {
		return nil, err
	}

	return &t, nil
}

func (r *TranslationRepository) GetByChapter(ctx context.Context, chapterID string) ([]model.Translation, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, chapter_id, page_index, image_hash, result, provider, created_at
		 FROM translations WHERE chapter_id = $1 ORDER BY page_index`,
		chapterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var translations []model.Translation
	for rows.Next() {
		var t model.Translation
		var resultJSON []byte
		if err := rows.Scan(&t.ID, &t.ChapterID, &t.PageIndex, &t.ImageHash, &resultJSON, &t.Provider, &t.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(resultJSON, &t.Result); err != nil {
			return nil, err
		}
		translations = append(translations, t)
	}

	if translations == nil {
		translations = []model.Translation{}
	}
	return translations, nil
}

func (r *TranslationRepository) Save(ctx context.Context, t *model.Translation) error {
	resultJSON, err := json.Marshal(t.Result)
	if err != nil {
		return err
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO translations (chapter_id, page_index, image_hash, result, provider)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (chapter_id, page_index) DO UPDATE 
		 SET result = $4, provider = $5, image_hash = $3, created_at = NOW()`,
		t.ChapterID, t.PageIndex, t.ImageHash, resultJSON, t.Provider,
	)
	return err
}

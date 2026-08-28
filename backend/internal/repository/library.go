package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/manga-manman/backend/internal/model"
)

type LibraryRepository struct {
	pool *pgxpool.Pool
}

func NewLibraryRepository(pool *pgxpool.Pool) *LibraryRepository {
	return &LibraryRepository{pool: pool}
}

func (r *LibraryRepository) GetAll(ctx context.Context) ([]model.LibraryEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manga_id, title, cover_url, COALESCE(category, 'reading'), added_at FROM library ORDER BY added_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []model.LibraryEntry
	for rows.Next() {
		var e model.LibraryEntry
		if err := rows.Scan(&e.ID, &e.MangaID, &e.Title, &e.CoverURL, &e.Category, &e.AddedAt); err != nil {
			return nil, err
		}
		e.Shelf = e.Category
		entries = append(entries, e)
	}

	if entries == nil {
		entries = []model.LibraryEntry{}
	}
	return entries, nil
}

func (r *LibraryRepository) GetByShelf(ctx context.Context, shelf string) ([]model.LibraryEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, manga_id, title, cover_url, COALESCE(category, 'reading'), added_at 
		 FROM library WHERE category = $1 ORDER BY added_at DESC`, shelf)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []model.LibraryEntry
	for rows.Next() {
		var e model.LibraryEntry
		if err := rows.Scan(&e.ID, &e.MangaID, &e.Title, &e.CoverURL, &e.Category, &e.AddedAt); err != nil {
			return nil, err
		}
		e.Shelf = e.Category
		entries = append(entries, e)
	}

	if entries == nil {
		entries = []model.LibraryEntry{}
	}
	return entries, nil
}

func (r *LibraryRepository) Add(ctx context.Context, req model.AddToLibraryRequest) (*model.LibraryEntry, error) {
	shelf := req.Shelf
	if shelf == "" {
		shelf = req.Category
	}
	if shelf == "" {
		shelf = "reading"
	}

	var entry model.LibraryEntry
	err := r.pool.QueryRow(ctx,
		`INSERT INTO library (manga_id, title, cover_url, category)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (manga_id) DO UPDATE SET title = $2, cover_url = $3, category = COALESCE(NULLIF($4, ''), library.category)
		 RETURNING id, manga_id, title, cover_url, category, added_at`,
		req.MangaID, req.Title, req.CoverURL, shelf,
	).Scan(&entry.ID, &entry.MangaID, &entry.Title, &entry.CoverURL, &entry.Category, &entry.AddedAt)
	if err != nil {
		return nil, err
	}
	entry.Shelf = entry.Category
	return &entry, nil
}

func (r *LibraryRepository) UpdateShelf(ctx context.Context, mangaID string, shelf string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE library SET category = $2 WHERE manga_id = $1`,
		mangaID, shelf,
	)
	return err
}

func (r *LibraryRepository) Remove(ctx context.Context, mangaID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM library WHERE manga_id = $1`, mangaID)
	return err
}

func (r *LibraryRepository) IsInLibrary(ctx context.Context, mangaID string) (bool, string, error) {
	var shelf string
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(category, 'reading') FROM library WHERE manga_id = $1`, mangaID,
	).Scan(&shelf)
	if err != nil {
		return false, "", nil
	}
	return true, shelf, nil
}

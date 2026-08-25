package service

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/manga-manman/backend/internal/model"
)

type LibraryService struct {
	pool *pgxpool.Pool
}

func NewLibraryService(pool *pgxpool.Pool) *LibraryService {
	return &LibraryService{pool: pool}
}

func (s *LibraryService) GetAll(ctx context.Context) ([]model.LibraryEntry, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, manga_id, title, cover_url, added_at FROM library ORDER BY added_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []model.LibraryEntry
	for rows.Next() {
		var e model.LibraryEntry
		if err := rows.Scan(&e.ID, &e.MangaID, &e.Title, &e.CoverURL, &e.AddedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}

	if entries == nil {
		entries = []model.LibraryEntry{}
	}
	return entries, nil
}

func (s *LibraryService) Add(ctx context.Context, req model.AddToLibraryRequest) (*model.LibraryEntry, error) {
	var entry model.LibraryEntry
	err := s.pool.QueryRow(ctx,
		`INSERT INTO library (manga_id, title, cover_url)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (manga_id) DO UPDATE SET title = $2, cover_url = $3
		 RETURNING id, manga_id, title, cover_url, added_at`,
		req.MangaID, req.Title, req.CoverURL,
	).Scan(&entry.ID, &entry.MangaID, &entry.Title, &entry.CoverURL, &entry.AddedAt)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func (s *LibraryService) Remove(ctx context.Context, mangaID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM library WHERE manga_id = $1`, mangaID)
	return err
}

func (s *LibraryService) IsInLibrary(ctx context.Context, mangaID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM library WHERE manga_id = $1)`, mangaID,
	).Scan(&exists)
	return exists, err
}

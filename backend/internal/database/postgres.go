package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute

	var pool *pgxpool.Pool
	var lastErr error

	// Retry connection up to 5 times with backoff
	for attempt := 1; attempt <= 5; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pool, err = pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				cancel()
				log.Println("✅ Connected to PostgreSQL")
				return pool, nil
			} else {
				lastErr = pingErr
				pool.Close()
			}
		} else {
			lastErr = err
		}
		cancel()

		log.Printf("⚠️ Database connection attempt %d/5 failed (%v), retrying in %ds...", attempt, lastErr, attempt*2)
		time.Sleep(time.Duration(attempt*2) * time.Second)
	}

	return nil, fmt.Errorf("failed to connect to database after 5 attempts: %w", lastErr)
}

func Migrate(pool *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	migrations := []string{
		`CREATE TABLE IF NOT EXISTS translations (
			id          SERIAL PRIMARY KEY,
			chapter_id  VARCHAR(255) NOT NULL,
			page_index  INT NOT NULL,
			image_hash  VARCHAR(255),
			result      JSONB NOT NULL,
			provider    VARCHAR(50) NOT NULL,
			created_at  TIMESTAMP DEFAULT NOW(),
			UNIQUE(chapter_id, page_index)
		)`,
		`CREATE TABLE IF NOT EXISTS library (
			id         SERIAL PRIMARY KEY,
			manga_id   VARCHAR(255) UNIQUE NOT NULL,
			title      TEXT NOT NULL,
			cover_url  TEXT,
			category   VARCHAR(50) DEFAULT 'reading',
			added_at   TIMESTAMP DEFAULT NOW()
		)`,
		`ALTER TABLE library ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'reading'`,
		`CREATE TABLE IF NOT EXISTS reading_history (
			id           SERIAL PRIMARY KEY,
			manga_id     VARCHAR(255) NOT NULL,
			chapter_id   VARCHAR(255) NOT NULL,
			page_index   INT DEFAULT 0,
			updated_at   TIMESTAMP DEFAULT NOW(),
			UNIQUE(manga_id, chapter_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_translations_chapter ON translations(chapter_id)`,
		`CREATE INDEX IF NOT EXISTS idx_history_manga ON reading_history(manga_id)`,
		`CREATE INDEX IF NOT EXISTS idx_library_category ON library(category)`,
	}

	for _, sql := range migrations {
		if _, err := pool.Exec(ctx, sql); err != nil {
			return fmt.Errorf("run migration: %w", err)
		}
	}

	log.Println("✅ Database migrations complete")
	return nil
}

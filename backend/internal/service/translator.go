package service

import (
	"context"

	"github.com/manga-manman/backend/internal/model"
)

// Translator defines the interface for manga page translation providers.
// Implementations can be swapped via the MANGA_TRANSLATOR env var.
type Translator interface {
	// TranslatePage takes a manga page image URL and returns extracted + translated text blocks.
	TranslatePage(ctx context.Context, imageURL string) (*model.TranslationResult, error)

	// Provider returns the name of this translation provider (e.g., "groq", "ocr").
	Provider() string
}

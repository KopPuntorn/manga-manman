package config

import (
	"os"
)

type Config struct {
	Port            string
	DatabaseURL     string
	GroqAPIKey      string
	GeminiAPIKey    string
	MangaTranslator string
	FrontendURL     string
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://mangamanman:mangamanman@localhost:5432/mangamanman?sslmode=disable"),
		GroqAPIKey:      getEnv("GROQ_API_KEY", ""),
		GeminiAPIKey:    getEnv("GEMINI_API_KEY", ""),
		MangaTranslator: getEnv("MANGA_TRANSLATOR", "groq"),
		FrontendURL:     getEnv("FRONTEND_URL", "http://localhost:3000"),
	}
}


func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

package config

import (
	"bufio"
	"log"
	"os"
	"strings"
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
	loadDotEnv(".env")
	loadDotEnv("../.env")

	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://mangamanman:mangamanman@localhost:5432/mangamanman?sslmode=disable"),
		GroqAPIKey:      getEnv("GROQ_API_KEY", ""),
		GeminiAPIKey:    getEnv("GEMINI_API_KEY", ""),
		MangaTranslator: getEnv("MANGA_TRANSLATOR", "groq"),
		FrontendURL:     getEnv("FRONTEND_URL", "http://localhost:3000"),
	}
}

func loadDotEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			// Only set if not already set by system environment
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
			}
		}
	}
	log.Printf("📄 Loaded environment variables from %s", filepath)
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}


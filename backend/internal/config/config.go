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
	GroqAPIKeys     []string
	GeminiAPIKey    string
	GeminiAPIKeys   []string
	GeminiModel     string
	MangaTranslator string
	FrontendURL     string
}

func Load() *Config {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	groqSingle := getEnv("GROQ_API_KEY", "")
	groqMulti := getEnv("GROQ_API_KEYS", "")
	groqKeys := parseKeys(groqSingle, groqMulti)

	geminiSingle := getEnv("GEMINI_API_KEY", "")
	geminiMulti := getEnv("GEMINI_API_KEYS", "")
	geminiKeys := parseKeys(geminiSingle, geminiMulti)

	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://mangamanman:mangamanman@localhost:5432/mangamanman?sslmode=disable"),
		GroqAPIKey:      groqSingle,
		GroqAPIKeys:     groqKeys,
		GeminiAPIKey:    geminiSingle,
		GeminiAPIKeys:   geminiKeys,
		GeminiModel:     getEnv("GEMINI_MODEL", ""),
		MangaTranslator: getEnv("MANGA_TRANSLATOR", "gemini"),
		FrontendURL:     getEnv("FRONTEND_URL", "http://localhost:3000"),
	}
}

func parseKeys(singleKey, multiKey string) []string {
	var raw string
	if multiKey != "" && singleKey != "" {
		raw = multiKey + "," + singleKey
	} else if multiKey != "" {
		raw = multiKey
	} else {
		raw = singleKey
	}

	seen := make(map[string]bool)
	var keys []string
	for _, part := range strings.Split(raw, ",") {
		k := strings.TrimSpace(part)
		if k != "" && !seen[k] {
			seen[k] = true
			keys = append(keys, k)
		}
	}
	return keys
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


package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/manga-manman/backend/internal/model"
)

type GeminiTranslator struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGeminiTranslator(apiKey string) *GeminiTranslator {
	// Optimized HTTP client with connection pooling for sub-second requests
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
	}

	return &GeminiTranslator{
		apiKey: apiKey,
		model:  "gemini-flash-lite-latest",
		client: &http.Client{
			Transport: transport,
			Timeout:   45 * time.Second,
		},
	}
}

func (g *GeminiTranslator) Provider() string {
	return "gemini"
}

func (g *GeminiTranslator) TranslatePage(ctx context.Context, imageURL string) (*model.TranslationResult, error) {
	// Download the image and convert to base64
	imgReq, err := http.NewRequestWithContext(ctx, "GET", imageURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create image request: %w", err)
	}
	imgReq.Header.Set("User-Agent", "MangaManman/1.0")

	imgResp, err := g.client.Do(imgReq)
	if err != nil {
		return nil, fmt.Errorf("download image: %w", err)
	}
	defer imgResp.Body.Close()

	if imgResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download image failed with status %d", imgResp.StatusCode)
	}

	imgBytes, err := io.ReadAll(imgResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read image bytes: %w", err)
	}

	// Optimize image: downscale to 900px width for fastest OCR upload & sub-second processing
	compressedBytes, err := optimizeMangaImage(imgBytes, 900)
	if err != nil {
		compressedBytes = imgBytes
	}

	base64Data := base64.StdEncoding.EncodeToString(compressedBytes)
	contentType := "image/jpeg"



	prompt := `You are an expert Japanese manga translator. Analyze this manga page image and:
1. Find ALL dialogue and text blocks in speech bubbles, thought bubbles, narrator boxes, and sound effects.
2. Read the original text (usually Japanese).
3. Translate each text block accurately and naturally into Thai.
4. Estimate bounding box coordinates (x, y, width, height) in 0.0 to 1.0 relative coordinates where (0,0) is top-left.

Return ONLY a valid JSON object matching this schema:
{
  "texts": [
    {
      "original": "original Japanese text",
      "thai": "คำแปลภาษาไทยที่ลื่นไหล",
      "x": 0.32,
      "y": 0.18,
      "width": 0.20,
      "height": 0.10
    }
  ]
}
If no text is on the page, return {"texts": []}.`

	geminiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", g.model, g.apiKey)

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{
						"text": prompt,
					},
					{
						"inline_data": map[string]string{
							"mime_type": contentType,
							"data":      base64Data,
						},
					},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.1,
			"responseMimeType": "application/json",
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal gemini request: %w", err)
	}

	var respBody []byte

	// Retry up to 3 times on temporary 503 or 429 errors
	for attempt := 0; attempt < 3; attempt++ {

		req, err := http.NewRequestWithContext(ctx, "POST", geminiURL, bytes.NewReader(jsonBody))
		if err != nil {
			return nil, fmt.Errorf("create gemini request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := g.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("do gemini request: %w", err)
		}

		respBody, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("read gemini response: %w", err)
		}

		if resp.StatusCode == http.StatusOK {
			break
		}


		// If temporary high demand (503) or rate limit (429), sleep and retry
		if (resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests) && attempt < 2 {
			time.Sleep(time.Duration(attempt+1) * 1500 * time.Millisecond)
			continue
		}

		return nil, fmt.Errorf("gemini API returned %d: %s", resp.StatusCode, string(respBody))
	}


	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("unmarshal gemini response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	text := geminiResp.Candidates[0].Content.Parts[0].Text
	text = extractJSON(text)

	var result model.TranslationResult
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return nil, fmt.Errorf("unmarshal translation result: %w (content: %s)", err, text)
	}

	return &result, nil
}

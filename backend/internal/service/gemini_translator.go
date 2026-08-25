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
	// Optimized HTTP client with connection pooling
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
	}

	return &GeminiTranslator{
		apiKey: apiKey,
		model:  "gemini-3.1-flash-lite",
		client: &http.Client{
			Transport: transport,
			Timeout:   90 * time.Second,
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



	prompt := `You are an expert Japanese manga OCR and Thai translator. Analyze this manga page carefully.

Instructions:
1. Detect ALL text on this page: speech bubbles, thought clouds, narration boxes, side notes, floating monologue, and Japanese sound effects.
2. Read the original text (Japanese/English).
3. Translate each text block accurately and naturally into Thai dialogue.
4. Provide precise normalized bounding box coordinates for each bubble as float values between 0.0 and 1.0:
   - "x": left position (0.0 = left edge, 1.0 = right edge)
   - "y": top position (0.0 = top edge, 1.0 = bottom edge)
   - "width": width of bubble (usually 0.12 to 0.40)
   - "height": height of bubble (usually 0.05 to 0.30)

Return ONLY valid JSON matching this schema:
{
  "texts": [
    {
      "original": "original text",
      "thai": "คำแปลภาษาไทยที่ถูกต้องและเป็นธรรมชาติ",
      "x": 0.35,
      "y": 0.20,
      "width": 0.22,
      "height": 0.12
    }
  ]
}
If the page contains no text, return {"texts": []}.`


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

	// Retry up to 4 times on temporary 503 or 429 rate limit errors
	for attempt := 0; attempt < 4; attempt++ {

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

		// If temporary high demand (503) or rate limit (429), sleep and retry with backoff
		if (resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests) && attempt < 3 {
			sleepDuration := time.Duration(attempt+1) * 2500 * time.Millisecond
			if resp.StatusCode == http.StatusTooManyRequests {
				sleepDuration = time.Duration(attempt+1) * 3500 * time.Millisecond
			}
			time.Sleep(sleepDuration)
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

	// Normalize and sanitize coordinates (ensure 0.0 <= val <= 1.0)
	for i := range result.Texts {
		t := &result.Texts[i]
		// If model returned on 0-1000 scale
		if t.X > 10.0 {
			if t.X > 100.0 {
				t.X /= 1000.0
			} else {
				t.X /= 100.0
			}
		}
		if t.Y > 10.0 {
			if t.Y > 100.0 {
				t.Y /= 1000.0
			} else {
				t.Y /= 100.0
			}
		}
		if t.Width > 10.0 {
			if t.Width > 100.0 {
				t.Width /= 1000.0
			} else {
				t.Width /= 100.0
			}
		}
		if t.Height > 10.0 {
			if t.Height > 100.0 {
				t.Height /= 1000.0
			} else {
				t.Height /= 100.0
			}
		}

		// Clamp bounds
		if t.X < 0 {
			t.X = 0
		}
		if t.X > 0.90 {
			t.X = 0.85
		}
		if t.Y < 0 {
			t.Y = 0
		}
		if t.Y > 0.95 {
			t.Y = 0.90
		}
		if t.Width < 0.08 {
			t.Width = 0.18
		}
		if t.Width > 0.70 {
			t.Width = 0.50
		}
		if t.Height < 0.04 {
			t.Height = 0.08
		}
		if t.Height > 0.60 {
			t.Height = 0.40
		}
	}

	return &result, nil
}


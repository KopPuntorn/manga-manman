package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/manga-manman/backend/internal/model"
)




type GeminiTranslator struct {
	apiKeys  []string
	keyIndex uint64
	model    string
	client   *http.Client
}

func NewGeminiTranslator(apiKeys []string) *GeminiTranslator {
	// Optimized HTTP client with connection pooling
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
	}

	return &GeminiTranslator{
		apiKeys:  apiKeys,
		keyIndex: 0,
		model:    "gemini-3.1-flash-lite",
		client: &http.Client{
			Transport: transport,
			Timeout:   90 * time.Second,
		},
	}
}

func (g *GeminiTranslator) getKey(offset int) string {
	if len(g.apiKeys) == 0 {
		return ""
	}
	idx := (atomic.LoadUint64(&g.keyIndex) + uint64(offset)) % uint64(len(g.apiKeys))
	return g.apiKeys[idx]
}

func (g *GeminiTranslator) advanceKey() {
	if len(g.apiKeys) > 1 {
		atomic.AddUint64(&g.keyIndex, 1)
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



	prompt := `You are an expert manga OCR reader and professional Thai manga typesetter.
Carefully examine this manga page image.

STRICT INSTRUCTIONS:
1. Detect ONLY dialogue, speech, and narration inside:
   - Speech bubbles (oval, round, spiky, screaming bubbles)
   - Thought clouds (internal monologue)
   - Rectangular narrator / caption boxes
2. DO NOT detect or translate sound effects (SFX / onomatopoeia), background sound words, or author credits.
3. For each dialogue / narration bubble:
   - Transcribe the original dialogue text.
   - Translate accurately into fluent, natural, engaging Thai manga dialogue.
   - Detect the FULL BOUNDING BOX of the entire speech bubble area using box_2d [ymin, xmin, ymax, xmax] (normalized 0 to 1000 scale) so the Thai overlay can perfectly fit and fully cover the original text area:
     * ymin: top edge of bubble (0 to 1000)
     * xmin: left edge of bubble (0 to 1000)
     * ymax: bottom edge of bubble (0 to 1000)
     * xmax: right edge of bubble (0 to 1000)

Return ONLY valid JSON matching this schema:
{
  "texts": [
    {
      "original": "original dialogue",
      "thai": "คำแปลภาษาไทยที่เป็นธรรมชาติและสละสลวย",
      "box_2d": [180, 240, 290, 360]
    }
  ]
}
If no dialogue bubbles exist on this page, return {"texts": []}.`





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

	// Retry up to 4 times (cycling through API keys on 429/503)
	for attempt := 0; attempt < 4; attempt++ {
		currentKey := g.getKey(attempt)
		geminiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", g.model, currentKey)

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
			g.advanceKey()
			break
		}

		// If rate limited (429) and we have multiple keys, immediately advance to the next key without sleep!
		if resp.StatusCode == http.StatusTooManyRequests && len(g.apiKeys) > 1 {
			g.advanceKey()
			continue
		}

		// If temporary high demand (503) or rate limit (429), sleep and retry with backoff
		if (resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests) && attempt < 3 {
			sleepDuration := time.Duration(attempt+1) * 2000 * time.Millisecond
			if resp.StatusCode == http.StatusTooManyRequests {
				sleepDuration = time.Duration(attempt+1) * 3000 * time.Millisecond
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
		// Empty response from Gemini (e.g. textless page or non-speech panel)
		return &model.TranslationResult{Texts: []model.TextBlock{}}, nil
	}

	text := geminiResp.Candidates[0].Content.Parts[0].Text
	text = extractJSON(text)
	text = sanitizeJSONString(text)

	var rawResult struct {
		Texts []struct {
			Original string      `json:"original"`
			Thai     string      `json:"thai"`
			Box2D    interface{} `json:"box_2d"`
			X        float64     `json:"x"`
			Y        float64     `json:"y"`
			Width    float64     `json:"width"`
			Height   float64     `json:"height"`
		} `json:"texts"`
	}


	if err := json.Unmarshal([]byte(text), &rawResult); err != nil {
		// If unmarshal fails on textless responses, return clean empty result
		return &model.TranslationResult{Texts: []model.TextBlock{}}, nil
	}

	var result model.TranslationResult
	for _, item := range rawResult.Texts {
		tb := model.TextBlock{
			Original: item.Original,
			Thai:     item.Thai,
		}

		ymin, xmin, ymax, xmax, ok := parseBox2D(item.Box2D)
		if ok {
			// Convert box_2d 0-1000 to normalized 0.0-1.0
			tb.Y = ymin / 1000.0
			tb.X = xmin / 1000.0
			tb.Height = (ymax - ymin) / 1000.0
			tb.Width = (xmax - xmin) / 1000.0
		} else {
			tb.X = item.X
			tb.Y = item.Y
			tb.Width = item.Width
			tb.Height = item.Height

			// If scale is 0-100 or 0-1000
			if tb.X > 10.0 {
				if tb.X > 100.0 {
					tb.X /= 1000.0
				} else {
					tb.X /= 100.0
				}
			}
			if tb.Y > 10.0 {
				if tb.Y > 100.0 {
					tb.Y /= 1000.0
				} else {
					tb.Y /= 100.0
				}
			}
			if tb.Width > 10.0 {
				if tb.Width > 100.0 {
					tb.Width /= 1000.0
				} else {
					tb.Width /= 100.0
				}
			}
			if tb.Height > 10.0 {
				if tb.Height > 100.0 {
					tb.Height /= 1000.0
				} else {
					tb.Height /= 100.0
				}
			}
		}


		// Clamp bounds safely
		if tb.X < 0 {
			tb.X = 0
		}
		if tb.X > 0.92 {
			tb.X = 0.88
		}
		if tb.Y < 0 {
			tb.Y = 0
		}
		if tb.Y > 0.95 {
			tb.Y = 0.90
		}
		if tb.Width < 0.10 {
			tb.Width = 0.18
		}
		if tb.Height < 0.04 {
			tb.Height = 0.08
		}

		result.Texts = append(result.Texts, tb)
	}


	return &result, nil
}

func parseBox2D(raw interface{}) (float64, float64, float64, float64, bool) {
	if raw == nil {
		return 0, 0, 0, 0, false
	}
	// Case 1: []interface{}
	if slice, ok := raw.([]interface{}); ok {
		if len(slice) == 4 {
			// [ymin, xmin, ymax, xmax]
			ymin := toFloat(slice[0])
			xmin := toFloat(slice[1])
			ymax := toFloat(slice[2])
			xmax := toFloat(slice[3])
			return ymin, xmin, ymax, xmax, true
		} else if len(slice) > 0 {
			// [[ymin, xmin, ymax, xmax]]
			if innerSlice, ok := slice[0].([]interface{}); ok && len(innerSlice) == 4 {
				ymin := toFloat(innerSlice[0])
				xmin := toFloat(innerSlice[1])
				ymax := toFloat(innerSlice[2])
				xmax := toFloat(innerSlice[3])
				return ymin, xmin, ymax, xmax, true
			}
		}
	}
	return 0, 0, 0, 0, false
}

func toFloat(val interface{}) float64 {
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	}
	return 0
}

func sanitizeJSONString(s string) string {
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, `"thai":`) || strings.HasPrefix(trimmed, `"original":`) {
			colonIdx := strings.Index(line, ":")
			if colonIdx != -1 {
				valPart := strings.TrimSpace(line[colonIdx+1:])
				if strings.HasPrefix(valPart, `"`) && (strings.HasSuffix(valPart, `",`) || strings.HasSuffix(valPart, `"`)) {
					hasComma := strings.HasSuffix(valPart, ",")
					valText := valPart[1 : len(valPart)-1]
					if hasComma {
						valText = valPart[1 : len(valPart)-2]
					}
					// Replace internal unescaped double quotes with single quotes
					cleanedVal := strings.ReplaceAll(valText, `\"`, `'`)
					cleanedVal = strings.ReplaceAll(cleanedVal, `"`, `'`)
					if hasComma {
						lines[i] = line[:colonIdx+1] + ` "` + cleanedVal + `",`
					} else {
						lines[i] = line[:colonIdx+1] + ` "` + cleanedVal + `"`
					}
				}
			}
		}
	}
	return strings.Join(lines, "\n")
}




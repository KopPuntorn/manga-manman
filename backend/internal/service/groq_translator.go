package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/manga-manman/backend/internal/model"
)

const (
	groqAPIURL   = "https://api.groq.com/openai/v1/chat/completions"
	groqModel    = "meta-llama/llama-4-scout-17b-16e-instruct"
)

type GroqTranslator struct {
	apiKey string
	client *http.Client
}

func NewGroqTranslator(apiKey string) *GroqTranslator {
	return &GroqTranslator{
		apiKey: apiKey,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (g *GroqTranslator) Provider() string {
	return "groq"
}

func (g *GroqTranslator) TranslatePage(ctx context.Context, imageURL string) (*model.TranslationResult, error) {
	prompt := `You are a manga translation expert. Analyze this manga page image and:
1. Find ALL text/dialogue in speech bubbles, thought bubbles, sound effects, and narration boxes
2. Read the original text (usually Japanese)
3. Translate each text block to Thai
4. Estimate the position of each text block as relative coordinates (0-1 range, where 0,0 is top-left)

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:
{
  "texts": [
    {
      "original": "original text here",
      "thai": "Thai translation here",
      "x": 0.32,
      "y": 0.18,
      "width": 0.20,
      "height": 0.10
    }
  ]
}

Rules:
- x, y are the top-left corner of the text block (0-1 relative to image dimensions)
- width, height are the size of the text block (0-1 relative to image dimensions)
- Include ALL visible text, even small sound effects
- If there is no text on the page, return {"texts": []}
- Translate naturally and colloquially to Thai, keeping the tone/emotion of the original
- Return ONLY the JSON, nothing else`

	reqBody := map[string]interface{}{
		"model": groqModel,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type": "image_url",
						"image_url": map[string]string{
							"url": imageURL,
						},
					},
				},
			},
		},
		"temperature": 0.1,
		"max_tokens":  4096,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", groqAPIURL, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.apiKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Groq API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBody, &groqResp); err != nil {
		return nil, fmt.Errorf("unmarshal groq response: %w", err)
	}

	if len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in groq response")
	}

	content := groqResp.Choices[0].Message.Content

	// Try to extract JSON from the response (handle potential markdown wrapping)
	content = extractJSON(content)

	var result model.TranslationResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("unmarshal translation result: %w (content: %s)", err, content)
	}

	return &result, nil
}

// extractJSON tries to find a JSON object in the response, stripping markdown code blocks if present
func extractJSON(s string) string {
	// Try to find JSON between ```json and ```
	start := -1
	end := -1

	for i := 0; i < len(s)-6; i++ {
		if s[i:i+7] == "```json" {
			start = i + 7
		} else if s[i:i+3] == "```" && start > 0 {
			end = i
			break
		}
	}

	if start > 0 && end > start {
		return s[start:end]
	}

	// Try to find raw JSON object
	braceStart := -1
	braceCount := 0
	for i, c := range s {
		if c == '{' {
			if braceStart == -1 {
				braceStart = i
			}
			braceCount++
		} else if c == '}' {
			braceCount--
			if braceCount == 0 && braceStart >= 0 {
				return s[braceStart : i+1]
			}
		}
	}

	return s
}

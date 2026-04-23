package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type SMSError struct {
	Code   string            `json:"code"`
	Params map[string]string `json:"params,omitempty"`
}

type SendSMSResult struct {
	Success   bool           `json:"success"`
	Error     *SMSError      `json:"error,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
	Reference string         `json:"reference,omitempty"`
}

type RecipientResult struct {
	Recipient string    `json:"recipient"`
	Reference string    `json:"reference"`
	Success   bool      `json:"success"`
	Error     *SMSError `json:"error,omitempty"`
}

type SendSMSMultiResult struct {
	Success         bool              `json:"success"`
	SuccessCount    int               `json:"successCount"`
	RecipientsCount int               `json:"recipientsCount"`
	Results         []RecipientResult `json:"results"`
}

type CheckStatusResult struct {
	Success      bool     `json:"success"`
	StatusCode   *int     `json:"statusCode"`
	Status       string   `json:"status"`
	Timestamp    *string  `json:"timestamp"`
	Operator     *string  `json:"operator,omitempty"`
	Country      *string  `json:"country,omitempty"`
	CountryISO   *string  `json:"countryIso,omitempty"`
	Price        *float64 `json:"price,omitempty"`
	Currency     *string  `json:"currency,omitempty"`
	DeliveryTime *float64 `json:"deliveryTime,omitempty"`
}

func SendSMS(token, sender, recipient, message string) (*SendSMSResult, error) {
	reference := fmt.Sprintf("sms-%d", time.Now().Unix())
	return sendSMSWithReference(token, sender, recipient, message, reference)
}

func SendSMSMulti(token, sender string, recipients []string, message string) (*SendSMSMultiResult, error) {
	results := make([]RecipientResult, len(recipients))

	var wg sync.WaitGroup
	for i, recipient := range recipients {
		wg.Add(1)
		go func(index int, recipient string) {
			defer wg.Done()

			normalizedRecipient := strings.ReplaceAll(recipient, "+", "00")
			reference := fmt.Sprintf("sms-%d-%s", time.Now().Unix(), normalizedRecipient)

			result, err := sendSMSWithReference(token, sender, recipient, message, reference)
			if err != nil {
				results[index] = RecipientResult{
					Recipient: recipient,
					Reference: reference,
					Success:   false,
					Error: &SMSError{
						Code:   "upstream_error",
						Params: map[string]string{"detail": err.Error()},
					},
				}
				return
			}

			entry := RecipientResult{
				Recipient: recipient,
				Reference: reference,
				Success:   result.Success,
			}

			if !result.Success {
				entry.Error = result.Error
			}

			results[index] = entry
		}(i, recipient)
	}

	wg.Wait()

	successCount := 0
	for _, result := range results {
		if result.Success {
			successCount++
		}
	}

	return &SendSMSMultiResult{
		Success:         successCount > 0,
		SuccessCount:    successCount,
		RecipientsCount: len(recipients),
		Results:         results,
	}, nil
}

func sendSMSWithReference(token, sender, recipient, message, reference string) (*SendSMSResult, error) {
	normalizedRecipient := strings.ReplaceAll(recipient, "+", "00")

	payload := map[string]any{
		"messages": map[string]any{
			"msg": []any{
				map[string]any{
					"allowedChannels": []string{"SMS"},
					"from":            sender,
					"to":              []map[string]string{{"number": normalizedRecipient}},
					"body":            map[string]string{"content": message},
					"reference":       reference,
				},
			},
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode payload: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(http.MethodPost, "https://gw.cmtelecom.com/v1.0/message", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CM-PRODUCTTOKEN", token)

	resp, err := client.Do(req)
	if err != nil {
		return &SendSMSResult{
			Success: false,
			Error: &SMSError{
				Code:   "connection_error",
				Params: map[string]string{"detail": err.Error()},
			},
		}, nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var data map[string]any
	if len(body) > 0 {
		if err := json.Unmarshal(body, &data); err != nil {
			data = map[string]any{"raw": string(body)}
		}
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		details := data
		if details == nil {
			details = map[string]any{}
		}
		details["messages"] = map[string]any{
			"msg": []any{payload["messages"].(map[string]any)["msg"].([]any)[0]},
		}

		return &SendSMSResult{
			Success:   true,
			Details:   details,
			Reference: reference,
		}, nil
	}

	params := map[string]string{
		"status": fmt.Sprintf("%d", resp.StatusCode),
	}
	if details, ok := data["details"].(string); ok && details != "" {
		params["detail"] = details
	} else if messageText, ok := data["message"].(string); ok && messageText != "" {
		params["detail"] = messageText
	} else if errorCode, ok := data["errorCode"]; ok {
		params["detail"] = fmt.Sprintf("%v", errorCode)
	}

	return &SendSMSResult{
		Success: false,
		Error: &SMSError{
			Code:   "upstream_error",
			Params: params,
		},
		Details: data,
	}, nil
}

func CheckStatusMulti(token string, references []string) (map[string]*CheckStatusResult, error) {
	results := make(map[string]*CheckStatusResult, len(references))

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, reference := range references {
		wg.Add(1)
		go func(reference string) {
			defer wg.Done()

			result, httpCode, err := CheckStatus(token, reference)

			mu.Lock()
			defer mu.Unlock()

			if err != nil || httpCode != http.StatusOK {
				results[reference] = nil
				return
			}

			results[reference] = result
		}(reference)
	}

	wg.Wait()

	return results, nil
}

func CheckStatus(token, reference string) (*CheckStatusResult, int, error) {
	endDate := time.Now().UTC()
	startDate := endDate.Add(-24 * time.Hour)

	query := url.Values{}
	query.Set("startdate", startDate.Format("2006-01-02T15:04:05"))
	query.Set("enddate", endDate.Format("2006-01-02T15:04:05"))
	query.Set("reference", reference)
	query.Set("channel", "SMS")

	endpoint := "https://api.cmtelecom.com/v1.2/transactions/?" + query.Encode()

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-CM-PRODUCTTOKEN", token)

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("connection error: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	var data struct {
		Result []map[string]any `json:"result"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, 0, fmt.Errorf("failed to parse response: %w", err)
	}

	statusMap := map[int]int{
		37: 0,
		20: 2,
		21: 3,
		40: 1,
	}

	if len(data.Result) == 0 {
		return &CheckStatusResult{
			Success:    true,
			StatusCode: nil,
			Status:     "Pending",
			Timestamp:  nil,
		}, http.StatusOK, nil
	}

	tx := data.Result[0]
	statusCode := asIntPointer(tx["status"])

	var mapped *int
	if statusCode != nil {
		if m, ok := statusMap[*statusCode]; ok {
			mapped = &m
		}
	}

	return &CheckStatusResult{
		Success:      true,
		StatusCode:   mapped,
		Status:       asStringDefault(tx["statusdescription"], "Unknown"),
		Timestamp:    asStringPointer(tx["created"]),
		Operator:     asStringPointer(tx["operatorname"]),
		Country:      asStringPointer(tx["countryname"]),
		CountryISO:   asStringPointer(tx["countryiso"]),
		Price:        asFloat64Pointer(tx["price"]),
		Currency:     asStringPointer(tx["currency"]),
		DeliveryTime: asFloat64Pointer(tx["deliverytime"]),
	}, http.StatusOK, nil
}

func asIntPointer(value any) *int {
	switch v := value.(type) {
	case float64:
		result := int(v)
		return &result
	case int:
		result := v
		return &result
	case string:
		if v == "" {
			return nil
		}
		var parsed int
		if _, err := fmt.Sscanf(v, "%d", &parsed); err == nil {
			return &parsed
		}
	}

	return nil
}

func asFloat64Pointer(value any) *float64 {
	switch v := value.(type) {
	case float64:
		result := v
		return &result
	case int:
		result := float64(v)
		return &result
	case string:
		if v == "" {
			return nil
		}
		var parsed float64
		if _, err := fmt.Sscanf(v, "%f", &parsed); err == nil {
			return &parsed
		}
	}

	return nil
}

func asStringPointer(value any) *string {
	if value == nil {
		return nil
	}

	s, ok := value.(string)
	if !ok {
		return nil
	}

	if s == "" {
		return nil
	}

	result := s
	return &result
}

func asStringDefault(value any, defaultValue string) string {
	s, ok := value.(string)
	if !ok || s == "" {
		return defaultValue
	}

	return s
}

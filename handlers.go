package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
)

var referencePattern = regexp.MustCompile(`^sms-\d+-\d+$`)

func HandleSendSMS(cfg *Config) http.HandlerFunc {
	type request struct {
		Sender     string   `json:"sender"`
		Recipients []string `json:"recipients"`
		Message    string   `json:"message"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var body request
		if err := decodeJSONBody(r, &body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}

		body.Sender = strings.TrimSpace(body.Sender)
		body.Message = strings.TrimSpace(body.Message)

		recipients := make([]string, 0, len(body.Recipients))
		for _, recipient := range body.Recipients {
			trimmed := strings.TrimSpace(recipient)
			if trimmed == "" {
				continue
			}
			recipients = append(recipients, trimmed)
		}

		if body.Sender == "" || body.Message == "" || len(recipients) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "All fields are required"})
			return
		}

		result, err := SendSMSMulti(cfg.CMProductToken, body.Sender, recipients, body.Message)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}

		status := http.StatusOK
		if !result.Success {
			status = http.StatusBadGateway
		}

		writeJSON(w, status, result)
	}
}

func HandleCheckStatus(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		referencesRaw := strings.TrimSpace(r.URL.Query().Get("refs"))
		if referencesRaw == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "refs parameter required"})
			return
		}

		parts := strings.Split(referencesRaw, ",")
		references := make([]string, 0, len(parts))
		for _, part := range parts {
			reference := strings.TrimSpace(part)
			if reference == "" {
				continue
			}

			if !referencePattern.MatchString(reference) {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid reference format"})
				return
			}

			references = append(references, reference)
		}

		if len(references) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "refs parameter required"})
			return
		}

		results, err := CheckStatusMulti(cfg.CMProductToken, references)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"results": results})
	}
}

func HandleGetConfig(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"defaultSender":       cfg.DefaultSender,
			"authMode":            cfg.AuthMode,
			"oidcSkipLoginPage":   cfg.OIDCSkipLoginPage,
			"oidcLoginButtonText": cfg.OIDCLoginButtonText,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode JSON response: %v", err), http.StatusInternalServerError)
	}
}

func decodeJSONBody(r *http.Request, target any) error {
	if r.Body == nil {
		return errors.New("request body is required")
	}
	defer r.Body.Close()

	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))

	if err := dec.Decode(target); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}

	if dec.More() {
		return errors.New("invalid JSON body: multiple JSON values found")
	}

	return nil
}

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

type APIErrorPayload struct {
	Code   string            `json:"code"`
	Params map[string]string `json:"params,omitempty"`
}

func apiError(w http.ResponseWriter, status int, code string, params map[string]string) {
	writeJSON(w, status, map[string]any{
		"error": APIErrorPayload{Code: code, Params: params},
	})
}

func HandleSendSMS(cfg *Config) http.HandlerFunc {
	type request struct {
		Sender     string   `json:"sender"`
		Recipients []string `json:"recipients"`
		Message    string   `json:"message"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var body request
		if err := decodeJSONBody(r, &body); err != nil {
			apiError(w, http.StatusBadRequest, errorCodeForDecodeError(err), map[string]string{"detail": err.Error()})
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
			apiError(w, http.StatusBadRequest, "fields_required", nil)
			return
		}

		result, err := SendSMSMulti(cfg.CMProductToken, body.Sender, recipients, body.Message)
		if err != nil {
			apiError(w, http.StatusInternalServerError, "upstream_error", map[string]string{"detail": err.Error()})
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
			apiError(w, http.StatusBadRequest, "refs_required", nil)
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
				apiError(w, http.StatusBadRequest, "invalid_reference_format", map[string]string{"reference": reference})
				return
			}

			references = append(references, reference)
		}

		if len(references) == 0 {
			apiError(w, http.StatusBadRequest, "refs_required", nil)
			return
		}

		results, err := CheckStatusMulti(cfg.CMProductToken, references)
		if err != nil {
			apiError(w, http.StatusInternalServerError, "upstream_error", map[string]string{"detail": err.Error()})
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
			"copyCurlEnabled":     cfg.CopyCurlEnabled,
			"copyCurlToken":       cfg.CopyCurlCMProductToken,
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

var (
	errBodyRequired   = errors.New("request body is required")
	errInvalidJSON    = errors.New("invalid JSON body")
	errMultipleValues = errors.New("invalid JSON body: multiple JSON values found")
)

func errorCodeForDecodeError(err error) string {
	switch {
	case errors.Is(err, errBodyRequired):
		return "body_required"
	case errors.Is(err, errMultipleValues):
		return "invalid_json_body"
	default:
		return "invalid_json_body"
	}
}

func decodeJSONBody(r *http.Request, target any) error {
	if r.Body == nil {
		return errBodyRequired
	}
	defer r.Body.Close()

	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))

	if err := dec.Decode(target); err != nil {
		return fmt.Errorf("%w: %v", errInvalidJSON, err)
	}

	if dec.More() {
		return errMultipleValues
	}

	return nil
}

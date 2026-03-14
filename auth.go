package main

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type OIDCState struct {
	State     string
	ExpiresAt time.Time
}

var (
	oidcVerifier *oidc.IDTokenVerifier
	oauth2Config *oauth2.Config
	oidcStates   sync.Map
)

func AuthMiddleware(next http.Handler, cfg *Config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := GetSessionFromRequest(r)
		if !ok || !session.Authenticated {
			writeJSON(w, http.StatusUnauthorized, map[string]any{
				"error": "Unauthorized",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func HandleLogin(cfg *Config) http.HandlerFunc {
	type request struct {
		Password string `json:"password"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AuthMode != "password" {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error": "Password login is disabled",
			})
			return
		}

		var body request
		if err := decodeJSONBody(r, &body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}

		if body.Password != cfg.AccessPassword {
			writeJSON(w, http.StatusUnauthorized, map[string]any{
				"error": "Invalid password",
			})
			return
		}

		session, err := CreateSession(true)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("failed to create session: %v", err),
			})
			return
		}

		SetSessionCookie(w, session.ID)
		writeJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

func HandleLogout(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err == nil {
			DestroySession(cookie.Value)
		}

		ClearSessionCookie(w)
		writeJSON(w, http.StatusOK, map[string]any{"success": true})
	}
}

func HandleAuthStatus(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, ok := GetSessionFromRequest(r)
		authenticated := ok && session.Authenticated

		writeJSON(w, http.StatusOK, map[string]any{
			"authenticated": authenticated,
			"authMode":      cfg.AuthMode,
		})
	}
}

func HandleOIDCLogin(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AuthMode != "oidc" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "OIDC auth mode is not enabled"})
			return
		}

		if oauth2Config == nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "OIDC is not initialized"})
			return
		}

		cleanupOIDCStates()

		state, err := generateOIDCState()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to generate OIDC state"})
			return
		}

		oidcStates.Store(state, OIDCState{
			State:     state,
			ExpiresAt: time.Now().Add(10 * time.Minute),
		})

		http.Redirect(w, r, oauth2Config.AuthCodeURL(state), http.StatusFound)
	}
}

func HandleOIDCCallback(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cfg.AuthMode != "oidc" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "OIDC auth mode is not enabled"})
			return
		}

		if oauth2Config == nil || oidcVerifier == nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "OIDC is not initialized"})
			return
		}

		state := r.URL.Query().Get("state")
		code := r.URL.Query().Get("code")

		if state == "" || code == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "missing state or code"})
			return
		}

		stored, ok := oidcStates.Load(state)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid OIDC state"})
			return
		}

		oidcStates.Delete(state)

		stateData, ok := stored.(OIDCState)
		if !ok || stateData.State != state || time.Now().After(stateData.ExpiresAt) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "expired or invalid OIDC state"})
			return
		}

		token, err := oauth2Config.Exchange(context.Background(), code)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": fmt.Sprintf("token exchange failed: %v", err)})
			return
		}

		rawIDToken, ok := token.Extra("id_token").(string)
		if !ok || rawIDToken == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "missing id_token in token response"})
			return
		}

		if _, err := oidcVerifier.Verify(context.Background(), rawIDToken); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": fmt.Sprintf("failed to verify id_token: %v", err)})
			return
		}

		session, err := CreateSession(true)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("failed to create session: %v", err)})
			return
		}

		SetSessionCookie(w, session.ID)
		http.Redirect(w, r, "/", http.StatusFound)
	}
}

func InitializeOIDC(ctx context.Context, cfg *Config) error {
	if cfg.AuthMode != "oidc" {
		return nil
	}

	provider, err := oidc.NewProvider(ctx, cfg.OIDCIssuerURL)
	if err != nil {
		return fmt.Errorf("failed to initialize OIDC provider: %w", err)
	}

	oidcVerifier = provider.Verifier(&oidc.Config{ClientID: cfg.OIDCClientID})
	oauth2Config = &oauth2.Config{
		ClientID:     cfg.OIDCClientID,
		ClientSecret: cfg.OIDCClientSecret,
		RedirectURL:  cfg.OIDCRedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}

	return nil
}

func generateOIDCState() (string, error) {
	return generateSessionID()
}

func cleanupOIDCStates() {
	now := time.Now()
	oidcStates.Range(func(key, value any) bool {
		state, ok := value.(OIDCState)
		if !ok || now.After(state.ExpiresAt) {
			oidcStates.Delete(key)
		}
		return true
	})
}

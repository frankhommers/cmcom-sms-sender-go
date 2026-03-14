package main

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

const sessionCookieName = "session_id"

type Session struct {
	ID            string    `json:"id"`
	Authenticated bool      `json:"authenticated"`
	CreatedAt     time.Time `json:"createdAt"`
}

var sessions sync.Map

func CreateSession(authenticated bool) (*Session, error) {
	id, err := generateSessionID()
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:            id,
		Authenticated: authenticated,
		CreatedAt:     time.Now().UTC(),
	}

	sessions.Store(id, session)
	return session, nil
}

func GetSession(id string) (*Session, bool) {
	if id == "" {
		return nil, false
	}

	value, ok := sessions.Load(id)
	if !ok {
		return nil, false
	}

	session, ok := value.(*Session)
	if !ok {
		return nil, false
	}

	return session, true
}

func DestroySession(id string) {
	if id == "" {
		return
	}

	sessions.Delete(id)
}

func SetSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func GetSessionFromRequest(r *http.Request) (*Session, bool) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return nil, false
	}

	return GetSession(cookie.Value)
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func generateSessionID() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	return hex.EncodeToString(buf), nil
}

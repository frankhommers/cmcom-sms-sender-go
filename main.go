package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"path"
	"strings"
	"time"
)

//go:embed frontend/dist/*
var frontendFS embed.FS

func main() {
	cfg := LoadConfig()

	if err := InitializeOIDC(context.Background(), cfg); err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/login", HandleLogin(cfg))
	mux.Handle("POST /api/logout", AuthMiddleware(HandleLogout(cfg), cfg))
	mux.HandleFunc("GET /api/auth/status", HandleAuthStatus(cfg))
	mux.HandleFunc("GET /api/auth/oidc", HandleOIDCLogin(cfg))
	mux.HandleFunc("GET /api/auth/callback", HandleOIDCCallback(cfg))
	mux.Handle("POST /api/sms/send", AuthMiddleware(HandleSendSMS(cfg), cfg))
	mux.Handle("GET /api/sms/status", AuthMiddleware(HandleCheckStatus(cfg), cfg))
	mux.HandleFunc("GET /api/config", HandleGetConfig(cfg))

	frontendSubFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	mux.Handle("GET /", spaHandler(frontendSubFS))

	handler := withMiddleware(mux)
	addr := "0.0.0.0:" + cfg.Port

	log.Printf("Go SMS backend running on http://%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}

func withMiddleware(next http.Handler) http.Handler {
	return corsMiddleware(loggingMiddleware(next))
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(start))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func spaHandler(frontend fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(frontend))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if requestPath == "." || requestPath == "" {
			requestPath = "index.html"
		}

		if _, err := fs.Stat(frontend, requestPath); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		indexBytes, err := fs.ReadFile(frontend, "index.html")
		if err != nil {
			http.Error(w, "frontend unavailable", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(indexBytes)
	})
}

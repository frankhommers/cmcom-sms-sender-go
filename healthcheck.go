//go:build healthcheck

package main

import (
	"net/http"
	"os"
	"time"
)

func main() {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8080/api/config")
	if err != nil || resp.StatusCode >= 400 {
		os.Exit(1)
	}
	os.Exit(0)
}

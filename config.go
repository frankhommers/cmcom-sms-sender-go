package main

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	CMProductToken   string
	AuthMode         string
	AccessPassword   string
	OIDCIssuerURL    string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCRedirectURL  string
	DefaultSender    string
	Port             string
}

func LoadConfig() *Config {
	cfg := &Config{
		CMProductToken:   strings.TrimSpace(os.Getenv("CM_PRODUCT_TOKEN")),
		AuthMode:         defaultIfEmpty(strings.TrimSpace(os.Getenv("AUTH_MODE")), "password"),
		AccessPassword:   os.Getenv("ACCESS_PASSWORD"),
		OIDCIssuerURL:    strings.TrimSpace(os.Getenv("OIDC_ISSUER_URL")),
		OIDCClientID:     strings.TrimSpace(os.Getenv("OIDC_CLIENT_ID")),
		OIDCClientSecret: os.Getenv("OIDC_CLIENT_SECRET"),
		OIDCRedirectURL:  strings.TrimSpace(os.Getenv("OIDC_REDIRECT_URL")),
		DefaultSender:    defaultIfEmpty(strings.TrimSpace(os.Getenv("DEFAULT_SENDER")), "SendSMS"),
		Port:             defaultIfEmpty(strings.TrimSpace(os.Getenv("PORT")), "8080"),
	}

	cfg.Validate()
	return cfg
}

func (c *Config) Validate() {
	if c.CMProductToken == "" {
		panic("configuration error: CM_PRODUCT_TOKEN is required")
	}

	if c.AuthMode != "password" && c.AuthMode != "oidc" {
		panic(fmt.Sprintf("configuration error: AUTH_MODE must be 'password' or 'oidc', got %q", c.AuthMode))
	}

	if c.AuthMode == "password" && c.AccessPassword == "" {
		panic("configuration error: ACCESS_PASSWORD is required when AUTH_MODE=password")
	}

	if c.AuthMode == "oidc" {
		if c.OIDCIssuerURL == "" {
			panic("configuration error: OIDC_ISSUER_URL is required when AUTH_MODE=oidc")
		}
		if c.OIDCClientID == "" {
			panic("configuration error: OIDC_CLIENT_ID is required when AUTH_MODE=oidc")
		}
		if c.OIDCClientSecret == "" {
			panic("configuration error: OIDC_CLIENT_SECRET is required when AUTH_MODE=oidc")
		}
		if c.OIDCRedirectURL == "" {
			panic("configuration error: OIDC_REDIRECT_URL is required when AUTH_MODE=oidc")
		}
	}
}

func defaultIfEmpty(value, fallback string) string {
	if value == "" {
		return fallback
	}

	return value
}

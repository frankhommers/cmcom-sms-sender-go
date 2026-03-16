# SMS Sender

A web-based SMS sending tool powered by the [CM.com](https://www.cm.com/) messaging API. Built with Go (backend) and React + TypeScript (frontend), packaged as a single Docker container.

## Features

- Send SMS to one or multiple recipients
- Live delivery status tracking
- Copy as cURL command for debugging/integration
- Two authentication modes: password or OIDC/SSO
- Configurable via environment variables

## Quick Start

### Docker

```bash
docker run -p 8080:8080 \
  -e CM_PRODUCT_TOKEN=your-token \
  -e AUTH_MODE=password \
  -e ACCESS_PASSWORD=your-password \
  ghcr.io/frankhommers/cmcom-sms-sender-go
```

### Docker Compose

```bash
cp .env.example .env
# Edit .env with your values
docker compose up
```

## Configuration

### Required

| Variable | Description |
|---|---|
| `CM_PRODUCT_TOKEN` | Your CM.com API product token |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `AUTH_MODE` | `password` | Authentication mode: `password` or `oidc` |
| `ACCESS_PASSWORD` | | Required when `AUTH_MODE=password` |

### OIDC / SSO

Required when `AUTH_MODE=oidc`:

| Variable | Default | Description |
|---|---|---|
| `OIDC_ISSUER_URL` | | OIDC provider URL (e.g. `https://accounts.google.com`) |
| `OIDC_CLIENT_ID` | | OAuth2 client ID |
| `OIDC_CLIENT_SECRET` | | OAuth2 client secret |
| `OIDC_REDIRECT_URL` | | Callback URL (e.g. `http://localhost:8080/api/auth/callback`) |
| `OIDC_SKIP_LOGIN_PAGE` | `false` | Skip the login page and redirect directly to the OIDC provider |
| `OIDC_LOGIN_BUTTON_TEXT` | `Sign in` | Custom text for the SSO login button |

### cURL Generator

| Variable | Default | Description |
|---|---|---|
| `COPY_CURL_ENABLED` | `true` | Show/hide the "Generate cURL" button |
| `COPY_CURL_CM_PRODUCT_TOKEN` | | Pre-fill the CM.com product token in generated cURL commands. If not set, a placeholder is used. |

### General

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_SENDER` | `SendSMS` | Default sender name (max 11 alphanumeric characters) |
| `PORT` | `8080` | HTTP server port |

## Development

### Prerequisites

- Go 1.23+
- Node.js 22+

### Running locally

```bash
# Backend
cp .env.example .env
# Edit .env with your values
go run .

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `localhost:8080`.

### Building

```bash
# Docker
docker build -t sms-sender .

# Or manually
cd frontend && npm run build && cd ..
go build -o sms-sender .
```

## Architecture

```
├── *.go                  # Go backend (API, auth, sessions, SMS)
├── cmd/healthcheck/      # Healthcheck binary for Docker
├── frontend/             # React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/   # UI components (LoginForm, SmsForm, etc.)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # API client
│   └── dist/             # Built frontend (embedded in Go binary)
├── Dockerfile            # Multi-stage: Node → Go → scratch
└── docker-compose.yml
```

The Go backend serves the built frontend as a single-page application and exposes a JSON API under `/api/`.

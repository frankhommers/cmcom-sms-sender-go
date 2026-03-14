FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.23-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /send-sms .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -tags healthcheck -o /healthcheck .

FROM scratch
COPY --from=backend /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend /send-sms /send-sms
COPY --from=backend /healthcheck /healthcheck
EXPOSE 8080
ENTRYPOINT ["/send-sms"]

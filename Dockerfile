# Build stage for Manga-Manman Backend
FROM golang:1.23-alpine AS builder
WORKDIR /app

# Copy dependency manifests from backend directory
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source code and build
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

# Run stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/main .

EXPOSE 8080
ENV PORT=8080
CMD ["./main"]

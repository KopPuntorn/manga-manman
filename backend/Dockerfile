# Build stage
FROM golang:alpine AS builder
WORKDIR /app

ENV GOTOOLCHAIN=auto

# Copy all repository files
COPY . .

# If building from repository root, move backend files to working directory
RUN if [ -d "backend" ]; then \
      cp -a backend/. .; \
      rm -rf backend frontend; \
    fi

# Download dependencies and build binary
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

# Run stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/main .

EXPOSE 8080
ENV PORT=8080
CMD ["./main"]

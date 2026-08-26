# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy all repository files
COPY . .

# If building from repository root, replace root files with frontend package
RUN if [ -d "frontend" ]; then \
      rm -f package.json package-lock.json; \
      cp -a frontend/. .; \
      rm -rf frontend backend; \
    fi

# Install dependencies and build Next.js
RUN npm install
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

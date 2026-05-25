# syntax=docker/dockerfile:1

FROM node:lts-bookworm AS builder
WORKDIR /src

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:lts-bookworm
WORKDIR /app

ENV NODE_ENV=production
ENV BROWSER_DISABLE_GPU=true

# Chromium/Playwright runtime dependencies for Render/Docker.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    libcups2 \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Install Chromium for Playwright.
RUN npx playwright install chromium

COPY --from=builder /src/.next ./.next
COPY --from=builder /src/public ./public
COPY --from=builder /src/next.config.mjs ./next.config.mjs

# Render web services expect the app to bind to 0.0.0.0 and usually PORT=10000.
EXPOSE 10000
CMD ["sh", "-c", "npm run start -- -p ${PORT:-10000} -H 0.0.0.0"]

# syntax=docker/dockerfile:1

FROM node:lts-bookworm AS builder
WORKDIR /src

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV npm_config_audit=false
ENV npm_config_fund=false

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:lts-bookworm
WORKDIR /app

ENV NODE_ENV=production
ENV BROWSER_DISABLE_GPU=true
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
ENV npm_config_audit=false
ENV npm_config_fund=false

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

# Do not skip Playwright browser download in the runtime image.
# @playwright/browser-chromium must install the exact browser revision expected by rebrowser-playwright-core.
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 npm ci --omit=dev --no-audit --no-fund

# Verify the browser expected by the installed Playwright stack exists in the image.
RUN node -e "const { chromium } = require('@playwright/browser-chromium'); console.log('Chromium executable:', chromium.executablePath());"

COPY --from=builder /src/.next ./.next
COPY --from=builder /src/public ./public
COPY --from=builder /src/next.config.mjs ./next.config.mjs

# Render web services expect the app to bind to 0.0.0.0 and usually PORT=10000.
EXPOSE 10000
CMD ["sh", "-c", "npm run start -- -p ${PORT:-10000} -H 0.0.0.0"]

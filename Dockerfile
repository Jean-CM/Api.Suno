# syntax=docker/dockerfile:1

FROM node:lts-bookworm AS builder
WORKDIR /src

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
ENV npm_config_audit=false
ENV npm_config_fund=false

COPY package*.json ./
RUN npm ci

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
COPY --from=builder /src/node_modules ./node_modules
COPY --from=builder /src/.next ./.next
COPY --from=builder /src/public ./public
COPY --from=builder /src/next.config.mjs ./next.config.mjs

RUN node node_modules/rebrowser-playwright-core/cli.js install chromium
RUN node -e "const fs=require('fs');const {chromium}=require('rebrowser-playwright-core');const p=chromium.executablePath();console.log('Rebrowser Chromium executable:',p);if(!fs.existsSync(p)){process.exit(1)}"

EXPOSE 10000
CMD ["sh", "-c", "npm run start -- -p ${PORT:-10000} -H 0.0.0.0"]

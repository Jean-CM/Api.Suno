# syntax=docker/dockerfile:1

# Playwright image v1.49.1 already includes the exact Chromium revision
# expected by rebrowser-playwright-core/playwright 1.49.x.
FROM mcr.microsoft.com/playwright:v1.49.1-noble AS builder
WORKDIR /src

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV npm_config_audit=false
ENV npm_config_fund=false

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.49.1-noble
WORKDIR /app

ENV NODE_ENV=production
ENV BROWSER_DISABLE_GPU=true
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV npm_config_audit=false
ENV npm_config_fund=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY --from=builder /src/node_modules ./node_modules
COPY --from=builder /src/.next ./.next
COPY --from=builder /src/public ./public
COPY --from=builder /src/next.config.mjs ./next.config.mjs

# Verify that the Chromium executable expected by rebrowser-playwright-core exists and FFmpeg is available.
RUN node -e "const fs=require('fs');const {chromium}=require('rebrowser-playwright-core');const p=chromium.executablePath();console.log('Rebrowser Chromium executable:',p);if(!fs.existsSync(p)){console.error('Missing Chromium executable:',p);process.exit(1)}"
RUN ffmpeg -version | head -n 1

EXPOSE 10000
CMD ["sh", "-c", "npm run start -- -p ${PORT:-10000} -H 0.0.0.0"]

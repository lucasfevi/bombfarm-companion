# Linux e2e runner — same Playwright browser stack as CI (Ubuntu + Chromium).
# Built by `node e2e/scripts/docker-run.mjs build-image` (Playwright version from package.json).
# syntax=docker/dockerfile:1
ARG PLAYWRIGHT_VERSION=1.61.1
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apt-get update \
  && apt-get install -y curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.12.1 --activate

WORKDIR /work

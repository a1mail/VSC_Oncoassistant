#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/VSC_Oncoassistant}"
REPO_URL="${REPO_URL:-https://github.com/a1mail/VSC_Oncoassistant.git}"
BRANCH="${BRANCH:-main}"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

docker compose pull || true
docker compose up -d --build

#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR/frontend"
npm ci
npm run build

cd "$ROOT_DIR"
rm -rf backend/static
mkdir -p backend/static
cp -R frontend/out/. backend/static/

#!/usr/bin/env bash
# Builds the zip to upload to the Chrome Web Store (extension files only).
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/columngrab-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -r -X "$OUT" manifest.json background.js content.js offscreen.html offscreen.js options \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png
echo "Built $OUT"

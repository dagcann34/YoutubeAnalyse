#!/usr/bin/env bash
# Renders the Chrome Web Store screenshots (1280x800, TR + EN) from the current build.
# Usage: npm run build && design/screenshot-mockup/render.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/design/store-screenshots"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
WORK="$(mktemp -d)"
PORT="${PORT:-8765}"

mkdir -p "$WORK/assets"
cp -R "$ROOT/dist/assets/." "$WORK/assets/"
cp "$WORK"/assets/index.html-*.js "$WORK/assets/panel.js"
cp "$WORK"/assets/index-*.css "$WORK/assets/panel.css"
cp "$HERE/mock.html" "$HERE/panel.html" "$ROOT/public/icon-16.png" "$ROOT/public/icon-48.png" "$WORK/"

python3 -m http.server "$PORT" --directory "$WORK" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER; rm -rf "$WORK"' EXIT
sleep 1

shot() { # lang file query
  mkdir -p "$OUT/$1"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1280,800 --virtual-time-budget=6000 --screenshot="$OUT/$1/$2" \
    "http://localhost:$PORT/mock.html?lang=$1&$3" >/dev/null 2>&1
  echo "$OUT/$1/$2"
}

shot tr 1-ozet.png       'page=watch&tab=Özet'
shot tr 2-anahtar.png    'page=watch&tab=Araçlar&action=keywords'
shot tr 3-transkript.png 'page=watch&tab=Araçlar&action=transcript'
shot tr 4-buyume.png     'page=watch&tab=Büyüme&hover=0.62'
shot tr 5-rozetler.png   'page=home&tab=Takip'

shot en 1-overview.png   'page=watch&tab=Overview'
shot en 2-keywords.png   'page=watch&tab=Tools&action=keywords'
shot en 3-transcript.png 'page=watch&tab=Tools&action=transcript'
shot en 4-growth.png     'page=watch&tab=Growth&hover=0.62'
shot en 5-badges.png     'page=home&tab=Tracking'

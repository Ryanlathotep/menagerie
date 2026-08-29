#!/usr/bin/env bash
# Live-check the public surfaces. Exits non-zero if any check fails.
set -uo pipefail

ITCH_PAGE="${ITCH_PAGE:-https://maligore.itch.io/menagerie}"
APP_URL="${APP_URL:-https://menagerie.lovable.app}"

fail=0

check_status() {
  local label="$1" url="$2"
  local code
  code=$(curl -sS -o /tmp/live_body.html -w '%{http_code}' -L --max-time 30 "$url" || echo 000)
  if [ "$code" = "200" ]; then
    echo "OK   $label ($url) -> $code"
  else
    echo "FAIL $label ($url) -> $code"
    fail=1
  fi
}

check_status "itch.io page" "$ITCH_PAGE"
if grep -qE 'html-classic\.itch\.zone|embedded_game|game_frame|embed_game_btn|load_iframe_btn' /tmp/live_body.html 2>/dev/null; then
  echo "OK   itch.io HTML5 embed present"
else
  echo "FAIL itch.io page has no HTML5 embed — butler may not have pushed to the html5 channel"
  fail=1
fi

check_status "published app" "$APP_URL"

if [ "$fail" -ne 0 ]; then
  echo "One or more live checks failed."
  exit 1
fi
echo "All live checks passed."

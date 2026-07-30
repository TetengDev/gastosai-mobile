#!/usr/bin/env bash
# Render every GastosAI app asset from scratchpad/icon.html.
#
# One HTML source, five variants, so the mark cannot drift between the iOS tile, the Android
# adaptive layers and the splash. Re-run after editing icon.html.
set -euo pipefail

S="$(cd "$(dirname "$0")" && pwd)"
# Defaults to this repo's assets/ — the only place these are consumed from.
OUT="${1:-$(cd "$S/../.." && pwd)/assets}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FF=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg

shot() { # shot <variant|-> <size> <outfile>
  local variant="$1" size="$2" out="$3" url="file://$S/icon.html"
  [ "$variant" != "-" ] && url="$url?v=$variant"
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --screenshot="$S/_raw.png" --window-size=1024,1024 \
    --default-background-color=00000000 "$url" >/dev/null 2>&1
  if [ "$size" = "1024" ]; then cp "$S/_raw.png" "$out"
  else "$FF" -nostdin -loglevel error -y -i "$S/_raw.png" -vf "scale=$size:$size" "$out"; fi
  printf "  %-34s %s\n" "$(basename "$out")" "$(( $(stat -f%z "$out") / 1024 ))KB"
}

echo "▶ rendering app assets into $OUT"
# iOS tile is opaque and full-bleed: the system applies the squircle mask itself, and a transparent
# icon is rejected at submission.
shot -      1024 "$OUT/icon.png"
shot fg     1024 "$OUT/android-icon-foreground.png"
shot bg     1024 "$OUT/android-icon-background.png"
shot mono   1024 "$OUT/android-icon-monochrome.png"
shot splash 1024 "$OUT/splash-icon.png"
shot -        48 "$OUT/favicon.png"
rm -f "$S/_raw.png"
echo "▶ done"

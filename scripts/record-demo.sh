#!/usr/bin/env bash
#
# Record a demo flow on the iOS simulator and send the video to Telegram.
#
# The pre-PR gate already demands that a change be *executed*, not just tested. This makes the
# evidence watchable: a short clip of the thing that changed, sent to the phone, so a human can
# verify it without setting up a simulator.
#
#   ./scripts/record-demo.sh chat "v0.8.0 — chat now renders results and confirms writes"
#
# Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the environment. Since the polyrepo split they
# live in `../gastosai-backend/.env` — this repo's own `.env` does not have them, and there is no
# root `.env` any more. Take just those two lines rather than sourcing the file, which holds
# unquoted values with spaces that the shell tries to run:
#
#   export $(grep -E '^TELEGRAM_' ../gastosai-backend/.env | xargs)
#
# Notes worth knowing before running this:
#
#   * **Nothing is sent unless everything is green.** Typecheck, lint and the unit tests run
#     first; the demo flow itself must pass. A clip that lands in Telegram therefore means "this
#     works" — which is the only thing that makes the channel worth watching. A failure keeps the
#     recording locally and tells you where it is.
#   * **The video shows the demo account's real financial data.** It goes to a Telegram chat and
#     Telegram keeps it. That is the point of the exercise, but it is a deliberate act, not a
#     side effect — nothing here runs automatically.
#   * Telegram caps bot uploads at 50 MB. A 60-second simulator recording is a few MB; recording
#     the whole Maestro suite is not, which is why demo flows are short and single-purpose.
#   * The recording is stopped with SIGINT, never SIGKILL. `simctl` writes the mp4 trailer on a
#     clean shutdown; killing it leaves a file that no player will open.
set -euo pipefail

FLOW="${1:-}"
CAPTION="${2:-Demo}"

if [[ -z "$FLOW" ]]; then
  echo "usage: $0 <demo-flow-name> [caption]" >&2
  echo "  flows: $(ls .maestro/demo/*.yaml 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/.yaml//' | tr '\n' ' ')" >&2
  exit 2
fi

FLOW_FILE=".maestro/demo/${FLOW}.yaml"
[[ -f "$FLOW_FILE" ]] || { echo "no such demo flow: $FLOW_FILE" >&2; exit 2; }

# Fail before recording rather than after, so a missing token does not waste a run.
: "${TELEGRAM_BOT_TOKEN:?set TELEGRAM_BOT_TOKEN (see the repo root .env)}"
: "${TELEGRAM_CHAT_ID:?set TELEGRAM_CHAT_ID (see the repo root .env)}"

command -v maestro >/dev/null || { echo "maestro not on PATH" >&2; exit 127; }
xcrun simctl list devices booted | grep -q Booted || { echo "no booted simulator" >&2; exit 1; }

# Green before recording, not after.
#
# A demo arriving in Telegram is a claim that the change is sound. Recording a passing flow while
# the type-checker is red would make that claim false — the flow only walks one path, and the
# broken thing is somewhere it does not go. Checked first so a failure costs seconds rather than a
# recording run.
#
# Set SKIP_CHECKS=1 only when re-recording something already verified in the same session.
if [[ "${SKIP_CHECKS:-}" != "1" ]]; then
  echo "▶ checking the build is green"
  for check in "npx tsc --noEmit:typecheck" "npx eslint .:lint" "npx jest --silent:tests"; do
    cmd="${check%%:*}"; name="${check##*:}"
    if ! output=$($cmd 2>&1); then
      echo "" >&2
      echo "✗ $name failed — nothing recorded, nothing sent." >&2
      echo "$output" | tail -15 >&2
      exit 1
    fi
    echo "  ✓ $name"
  done
fi

OUT="$(mktemp -d)/demo-${FLOW}.mp4"

echo "▶ recording $FLOW_FILE"
xcrun simctl io booted recordVideo --codec h264 --force "$OUT" &
REC_PID=$!
# Give the recorder a moment to attach; frames dropped here are the opening seconds of the demo.
sleep 2

set +e
maestro test "$FLOW_FILE"
FLOW_STATUS=$?
set -e

# SIGINT, not SIGKILL — see the note above about the mp4 trailer.
kill -INT "$REC_PID" 2>/dev/null || true
wait "$REC_PID" 2>/dev/null || true

# Undo whatever the demo created, now that the camera is off.
#
# A demo must leave the account as it found it, or the next run shows two lunches. But tidying up
# is not part of the product and has no business being filmed, so cleanup lives in its own flow and
# runs here. Its failure is reported and does not mask the demo's own result.
CLEANUP=".maestro/demo/cleanup/${FLOW}.yaml"
if [[ -f "$CLEANUP" ]]; then
  echo "▶ cleaning up (not recorded)"
  maestro test "$CLEANUP" >/dev/null 2>&1 || echo "  ⚠️ cleanup flow failed — check for leftover demo data" >&2
fi

[[ -s "$OUT" ]] || { echo "recording produced no file" >&2; exit 1; }
SIZE_MB=$(( $(stat -f%z "$OUT") / 1024 / 1024 ))
echo "▶ recorded ${SIZE_MB}MB"
if (( SIZE_MB >= 50 )); then
  echo "recording is ${SIZE_MB}MB; Telegram rejects bot uploads over 50MB. Shorten the flow." >&2
  exit 1
fi

# Nothing is sent unless the flow passed.
#
# A recording only means anything if it shows the feature working. Shipping a clip of a failure —
# even a clearly labelled one — turns the channel into somewhere things get skimmed, and the whole
# value of a demo is that arriving in Telegram means "this works".
#
# The file is kept, so a failure is still debuggable locally; it just does not get broadcast.
if (( FLOW_STATUS != 0 )); then
  echo "" >&2
  echo "✗ the flow failed — nothing sent." >&2
  echo "  recording kept for debugging: $OUT" >&2
  exit "$FLOW_STATUS"
fi

# A title card, when ffmpeg is available.
#
# These clips get forwarded to people who did not ask for a build report — a client opening a video
# should see what they are about to watch, not a simulator mid-tap. Two seconds of black with the
# caption on it is the difference between a recording and something you would show someone.
#
# Entirely optional: without ffmpeg the raw recording is sent, which is still correct.
SEND="$OUT"
if command -v ffmpeg >/dev/null; then
  echo "▶ adding a title card"
  TITLED="${OUT%.mp4}-titled.mp4"
  # Wrap at ~34 characters so a long caption does not run off a phone screen.
  TITLE_TEXT=$(printf '%s' "$CAPTION" | fold -s -w 34)
  if ffmpeg -nostdin -loglevel error -y \
      -f lavfi -i "color=c=0x0f0f13:s=886x1920:d=2.5" \
      -vf "drawtext=text='${TITLE_TEXT//\'/}':fontcolor=0xf0f0f0:fontsize=34:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=14" \
      -pix_fmt yuv420p "${TITLED%.mp4}-card.mp4" 2>/dev/null \
    && ffmpeg -nostdin -loglevel error -y \
      -i "${TITLED%.mp4}-card.mp4" -i "$OUT" \
      -filter_complex "[0:v]scale=886:1920,setsar=1[a];[1:v]scale=886:1920,setsar=1[b];[a][b]concat=n=2:v=1[v]" \
      -map "[v]" -pix_fmt yuv420p "$TITLED" 2>/dev/null \
    && [[ -s "$TITLED" ]]; then
    SEND="$TITLED"
  else
    # A cosmetic step must never cost the delivery — fall back to the raw recording.
    echo "  (title card failed; sending the raw recording)" >&2
  fi
fi

echo "▶ sending to Telegram"
RESPONSE=$(curl -s --max-time 180 \
  -F "chat_id=${TELEGRAM_CHAT_ID}" \
  -F "caption=${CAPTION}" \
  -F "video=@${SEND}" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo")

if ! grep -q '"ok":true' <<<"$RESPONSE"; then
  echo "Telegram rejected the upload:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

echo "✔ sent: $CAPTION"
exit "$FLOW_STATUS"

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
# Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the environment. They live in the repo root's
# .env; source it first, or export them yourself.
#
# Notes worth knowing before running this:
#
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

[[ -s "$OUT" ]] || { echo "recording produced no file" >&2; exit 1; }
SIZE_MB=$(( $(stat -f%z "$OUT") / 1024 / 1024 ))
echo "▶ recorded ${SIZE_MB}MB"
if (( SIZE_MB >= 50 )); then
  echo "recording is ${SIZE_MB}MB; Telegram rejects bot uploads over 50MB. Shorten the flow." >&2
  exit 1
fi

# A failed flow still gets sent, clearly marked: a recording of the failure is more useful than
# no recording, and silently dropping it would hide exactly what needs looking at.
STATUS_NOTE=""
(( FLOW_STATUS != 0 )) && STATUS_NOTE=$'\n\n⚠️ the flow FAILED — this clip shows the failure'

echo "▶ sending to Telegram"
RESPONSE=$(curl -s --max-time 180 \
  -F "chat_id=${TELEGRAM_CHAT_ID}" \
  -F "caption=${CAPTION}${STATUS_NOTE}" \
  -F "video=@${OUT}" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo")

if ! grep -q '"ok":true' <<<"$RESPONSE"; then
  echo "Telegram rejected the upload:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

echo "✔ sent: $CAPTION"
exit "$FLOW_STATUS"

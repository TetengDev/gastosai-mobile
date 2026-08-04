#!/usr/bin/env bash
#
# Record a demo flow on the iOS simulator and attach the video to its Linear issue.
#
# The pre-PR gate already demands that a change be *executed*, not just tested. This makes the
# evidence watchable: a short clip of the thing that changed, sitting on the work item, so a
# reviewer can verify it without setting up a simulator.
#
#   ./scripts/record-demo.sh chat "chat renders results and confirms writes" TEN-168
#
# Uploading is delegated to `../gastosai-app/scripts/attach_evidence.py`, which reads
# LINEAR_API_KEY from the workspace `.env`. Nothing here needs a token of its own. Set PR_NUMBER
# in the environment to also link the PR to the issue; without it the clip is attached alone,
# which is the common case since the demo is usually recorded before the PR exists.
#
# Notes worth knowing before running this:
#
#   * **Nothing is attached unless everything is green.** Typecheck, lint and the unit tests run
#     first; the demo flow itself must pass. A clip on the issue therefore means "this works" —
#     which is the only thing that makes it worth opening. A failure keeps the recording locally
#     and tells you where it is.
#   * **The video shows the demo account's real financial data.** It goes to Linear and Linear
#     keeps it. That is the point of the exercise, but it is a deliberate act, not a side effect —
#     nothing here runs automatically.
#   * Linear rejects uploads at or over 50 MB. A 60-second simulator recording is a few MB;
#     recording the whole Maestro suite is not, which is why demo flows are short and
#     single-purpose.
#   * The recording is stopped with SIGINT, never SIGKILL. `simctl` writes the mp4 trailer on a
#     clean shutdown; killing it leaves a file that no player will open.
set -euo pipefail

FLOW="${1:-}"
CAPTION="${2:-Demo}"
ISSUE="${3:-${LINEAR_ISSUE:-}}"

if [[ -z "$FLOW" || -z "$ISSUE" ]]; then
  echo "usage: $0 <demo-flow-name> <caption> <linear-issue>" >&2
  echo "  e.g.: $0 chat \"chat renders results and confirms writes\" TEN-168" >&2
  echo "  flows: $(ls .maestro/demo/*.yaml 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/.yaml//' | tr '\n' ' ')" >&2
  exit 2
fi

FLOW_FILE=".maestro/demo/${FLOW}.yaml"
[[ -f "$FLOW_FILE" ]] || { echo "no such demo flow: $FLOW_FILE" >&2; exit 2; }

# Fail before recording rather than after, so a missing prerequisite does not waste a run.
ATTACH="../gastosai-app/scripts/attach_evidence.py"
[[ -f "$ATTACH" ]] || {
  echo "cannot find $ATTACH — the workspace repo must be checked out beside this one" >&2
  exit 2
}

command -v maestro >/dev/null || { echo "maestro not on PATH" >&2; exit 127; }
# Also written without `| grep -q`, for the pipefail/SIGPIPE reason described below.
[[ "$(xcrun simctl list devices booted 2>/dev/null || true)" == *Booted* ]] \
  || { echo "no booted simulator" >&2; exit 1; }

# An ffmpeg that can actually draw text.
#
# Homebrew's plain `ffmpeg` formula is built **without libfreetype**, so it has no `drawtext` filter
# at all — and because everything below treats titling as cosmetic, that failed silently for months
# and every clip shipped bare. `ffmpeg-full` has it, and is keg-only, so it is not on PATH by
# default. Probe for the filter rather than for the binary: "ffmpeg exists" was exactly the check
# that gave the wrong answer.
# Not `… -filters | grep -q drawtext`: `grep -q` exits the moment it matches, ffmpeg takes SIGPIPE
# and dies 141, and `set -o pipefail` at the top of this file reports the *pipeline* as failed — so
# the probe answers "no drawtext" for a binary that has it. Read the list into a variable and match
# it in the shell instead. (The same trap applies to every `| grep -q` under pipefail.)
FFMPEG=""
for candidate in ffmpeg "$(brew --prefix ffmpeg-full 2>/dev/null)/bin/ffmpeg"; do
  [[ "$candidate" == "/bin/ffmpeg" ]] && continue   # empty brew prefix
  command -v "$candidate" >/dev/null 2>&1 || continue
  filters=$("$candidate" -hide_banner -filters 2>/dev/null || true)
  if [[ "$filters" == *" drawtext "* ]]; then
    FFMPEG="$candidate"
    break
  fi
done
FFPROBE=""
if [[ -z "$FFMPEG" ]]; then
  echo "⚠️  no ffmpeg with drawtext — the clip will be sent unnarrated." >&2
  echo "    A bare recording does not tell a client what they are looking at. Fix with:" >&2
  echo "      brew install ffmpeg-full" >&2
else
  # Probing needs no drawtext, but keep the pair together so both come from one build.
  FFPROBE="$(dirname "$FFMPEG")/ffprobe"
  [[ -x "$FFPROBE" ]] || FFPROBE="$(command -v ffprobe || true)"
fi

# Green before recording, not after.
#
# A demo on the issue is a claim that the change is sound. Recording a passing flow while
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

WORK="$(mktemp -d)"
OUT="$WORK/demo-${FLOW}.mp4"

echo "▶ recording $FLOW_FILE"
# The wall clock at frame zero. Captions are timed by subtracting this from the Maestro log's
# timestamps, so it has to be sub-second — BSD `date` has no `%N`, hence python.
REC_START=$(python3 -c 'import time; print(time.time())')
xcrun simctl io booted recordVideo --codec h264 --force "$OUT" &
REC_PID=$!
# Give the recorder a moment to attach; frames dropped here are the opening seconds of the demo.
sleep 2

set +e
maestro test "$FLOW_FILE"
FLOW_STATUS=$?
set -e

# Grab the run directory *now*, before the cleanup flow below writes a newer one.
RUN_DIR=$(ls -dt "$HOME"/.maestro/tests/*/ 2>/dev/null | head -1 || true)

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
  echo "recording is ${SIZE_MB}MB; Linear rejects uploads at or over 50MB. Shorten the flow." >&2
  exit 1
fi

# Nothing is attached unless the flow passed.
#
# A recording only means anything if it shows the feature working. Attaching a clip of a failure —
# even a clearly labelled one — turns the issue into somewhere things get skimmed, and the whole
# value of a demo is that a clip on the issue means "this works".
#
# The file is kept, so a failure is still debuggable locally; it just does not get published.
if (( FLOW_STATUS != 0 )); then
  echo "" >&2
  echo "✗ the flow failed — nothing attached." >&2
  echo "  recording kept for debugging: $OUT" >&2
  exit "$FLOW_STATUS"
fi

# ── Narration ───────────────────────────────────────────────────────────────────────────────────
#
# A raw recording is a person tapping a phone. Nobody watching it knows which feature is on trial or
# what they were supposed to notice, and the comment caption does not travel with the file once it is
# downloaded or screenshotted. So the clip has to explain itself: a title card naming the feature and
# what to look for, then a caption over each step.
#
# The captions come from `label:` on the flow's own steps and are timed from the Maestro run log —
# see `caption_filters` below for why that is the only way this stays in sync.
#
# Still strictly cosmetic. Every failure here falls through to attaching the recording as-is, because
# a clip that lands plain is worth more than one that does not land.
SEND="$OUT"
if [[ -n "$FFMPEG" ]]; then
  echo "▶ narrating"
  CARD_SECS=4
  CAPTIONED="$WORK/captioned.mp4"
  CARD="$WORK/card.mp4"
  TITLED="$WORK/demo-${FLOW}-titled.mp4"
  FONT="Helvetica"
  # The frame, then a band under it that captions live in. Everything — the card included — is built
  # at VIDEO_W x (VIDEO_H + BAND_H) so `concat` gets matching dimensions; mismatched ones make it
  # fail outright.
  VIDEO_W=886; VIDEO_H=1920; BAND_H=140
  CANVAS_H=$(( VIDEO_H + BAND_H ))
  FIT="scale=${VIDEO_W}:${VIDEO_H},setsar=1,pad=${VIDEO_W}:${CANVAS_H}:0:0:color=0x0f0f13"

  # Caption timings, read back out of the run we just filmed.
  #
  # Hand-written offsets cannot work here: a chat turn takes anywhere from eight to sixty seconds
  # depending on the model, so a timing that fits today desynchronises tomorrow. Maestro logs
  # `HH:MM:SS.mmm … <label> RUNNING` for every step, so the truth is already written down — this
  # subtracts the recording's start time from each labelled step's start.
  #
  # A caption holds until the *next* one starts rather than until its own step ends, so the clip is
  # never bare during the unlabelled steps in between. The text goes through `textfile=` because
  # drawtext reads `:` `'` `%` and `,` as syntax, and quoting them through two layers of shell and
  # filtergraph is how this would silently mangle a caption.
  caption_filters() {
    python3 - "$RUN_DIR" "$REC_START" "$WORK" "$FONT" "$OUT" "$FFPROBE" "$VIDEO_H" "$BAND_H" <<'PY'
import os, re, sys, datetime, subprocess

run_dir, rec_start, work, font = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
video, ffprobe = sys.argv[5], sys.argv[6]
VIDEO_H, BAND_H = int(sys.argv[7]), int(sys.argv[8])
log = os.path.join(run_dir, "maestro.log")
if not os.path.exists(log):
    sys.exit(1)

# The log stamps a time of day, not a date. Take the date from the run directory's name
# (2026-07-30_063947) so a recording that crosses midnight still lines up.
m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(run_dir.rstrip("/")))
if not m:
    sys.exit(1)
day = datetime.date.fromisoformat(m.group(1))

MARK = ">> "
beats = []
seen = set()
for line in open(log, errors="replace"):
    m = re.match(r"^(\d{2}):(\d{2}):(\d{2})\.(\d{3}).*?: (" + re.escape(MARK) + r".*?) RUNNING$", line.strip())
    if not m:
        continue
    h, mi, s, ms, label = m.groups()
    if label in seen:      # a retried step logs RUNNING again; the first is the real start
        continue
    seen.add(label)
    t = datetime.datetime.combine(day, datetime.time(int(h), int(mi), int(s), int(ms) * 1000))
    # Maestro logs local time; the recording start is a POSIX timestamp.
    beats.append((t.timestamp() - rec_start, label[len(MARK):].strip()))

if not beats:
    sys.exit(1)

# Clamp the last caption to the end of the video rather than guessing.
duration = None
try:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", video],
        capture_output=True, text=True)
    duration = float(out.stdout.strip())
except Exception:
    pass

# Cut the launcher off the front.
#
# The first ~25 seconds of every recording is Expo Go's launcher, the springboard, a bundle download
# and possibly a sign-in — a third of the clip, none of it the product. The first caption marks where
# the demo actually begins; keep a breath before it so the opening screen is not mid-transition.
LEAD_IN = 1.5
trim = max(0.0, beats[0][0] - LEAD_IN)
beats = [(t - trim, text) for t, text in beats]
if duration:
    duration -= trim

# No caption may flash past unread.
#
# Labels land on whichever step they describe, and some of those steps are a single tap: "Asking in
# plain English" held for 1.1s and "And it really landed" for 0.9s, which is not long enough to read.
# Push each start out far enough to give the one before it MIN_SHOWN, and let that cascade. The cost
# is that a late caption can lag its screen by the accumulated shortfall — a second or so in
# practice, which is a better trade than a caption nobody can read.
MIN_SHOWN = 2.2
adjusted = []
for i, (start, text) in enumerate(beats):
    if adjusted:
        start = max(start, adjusted[-1][0] + MIN_SHOWN)
    adjusted.append((max(start, 0.0), text))
beats = adjusted

print(f"TRIM={trim:.3f}")

filters = []
for i, (start, text) in enumerate(beats):
    start = max(start, 0.0)
    if i + 1 < len(beats):
        end = max(beats[i + 1][0], start + 0.5)
    else:
        end = duration if duration else start + 15.0
    path = os.path.join(work, f"cap{i}.txt")
    # Wrap so a caption cannot run off the side of a phone screen.
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > 34 and cur:
            lines.append(cur); cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    with open(path, "w") as fh:
        fh.write("\n".join(lines[:2]))
    # Drawn inside the padded band under the frame, not over it. A lower third laid on top covered
    # the tab bar — and "chat is reachable from every tab" is precisely what the tab bar is there to
    # show. Occluding the feature to label the feature is not a trade worth making.
    filters.append(
        f"drawtext=textfile={path}:font={font}:fontcolor=0xf5f5f5:fontsize=34"
        f":x=(w-text_w)/2:y={VIDEO_H}+({BAND_H}-th)/2:line_spacing=12"
        f":enable='between(t\\,{start:.3f}\\,{end:.3f})'"
    )
print(",".join(filters))
PY
  }

  PARSED=""
  if [[ -n "$RUN_DIR" ]]; then
    PARSED=$(caption_filters 2>/dev/null || true)
  fi
  # First line is the trim point, the rest is the filter chain.
  TRIM=$(sed -n '1s/^TRIM=//p' <<<"$PARSED")
  CAPTION_VF=$(sed -n '2p' <<<"$PARSED")
  [[ -n "$TRIM" ]] || TRIM=0

  if [[ -n "$CAPTION_VF" ]]; then
    N_CAPS=$(grep -o "drawtext=textfile" <<<"$CAPTION_VF" | wc -l | tr -d ' ')
    if "$FFMPEG" -nostdin -loglevel error -y -ss "$TRIM" -i "$OUT" \
        -vf "${FIT},${CAPTION_VF}" \
        -pix_fmt yuv420p -crf 26 "$CAPTIONED" 2>/dev/null && [[ -s "$CAPTIONED" ]]; then
      echo "  ✓ ${N_CAPS} step captions, ${TRIM%.*}s of launcher trimmed"
    else
      echo "  ⚠️ captions failed — carrying on with the title card only" >&2
      CAPTIONED=""
    fi
  else
    echo "  (no >> labels in $FLOW_FILE — no step captions)" >&2
    CAPTIONED=""
  fi

  # Normalise even when captioning was skipped, so `concat` always gets matching dimensions.
  if [[ -z "$CAPTIONED" ]]; then
    CAPTIONED="$WORK/scaled.mp4"
    "$FFMPEG" -nostdin -loglevel error -y -i "$OUT" -vf "$FIT" \
      -pix_fmt yuv420p -crf 26 "$CAPTIONED" 2>/dev/null || CAPTIONED="$OUT"
  fi

  # The title card. Headline is the caption argument; the "watch for" lines live in the flow's
  # `# @watch` header, so they are not retyped — and not forgotten — on every invocation.
  HEAD_TXT="$WORK/head.txt"; VER_TXT="$WORK/ver.txt"; DATE_TXT="$WORK/date.txt"; WATCH_TXT="$WORK/watch.txt"
  printf '%s' "$CAPTION" | fold -s -w 26 > "$HEAD_TXT"
  printf 'GastosAI for iOS %s' "$(node -p "require('./package.json').version" 2>/dev/null || echo "")" > "$VER_TXT"
  date '+%-d %B %Y' > "$DATE_TXT"
  sed -n 's/^# @watch  *//p' "$FLOW_FILE" | sed 's/^/-  /' > "$WATCH_TXT"
  [[ -s "$WATCH_TXT" ]] || printf -- '-  the feature, working\n' > "$WATCH_TXT"

  # One drawtext per centred line. A multi-line `textfile` is centred as a *block* — the lines inside
  # it stay left-aligned against the widest one, which reads as a layout mistake for a two-line
  # subtitle. The watch list wants exactly that block behaviour, so it stays one call.
  CARD_VF="drawtext=textfile=$HEAD_TXT:font=$FONT:fontcolor=0xf5f5f5:fontsize=52:x=(w-text_w)/2:y=640:line_spacing=16"
  CARD_VF+=",drawtext=textfile=$VER_TXT:font=$FONT:fontcolor=0x8a8a94:fontsize=30:x=(w-text_w)/2:y=800"
  CARD_VF+=",drawtext=textfile=$DATE_TXT:font=$FONT:fontcolor=0x8a8a94:fontsize=30:x=(w-text_w)/2:y=842"
  CARD_VF+=",drawtext=text='Watch for':font=$FONT:fontcolor=0x8a8a94:fontsize=28:x=(w-text_w)/2:y=1010"
  CARD_VF+=",drawtext=textfile=$WATCH_TXT:font=$FONT:fontcolor=0xe8e8ee:fontsize=32:x=(w-text_w)/2:y=1080:line_spacing=18"

  if "$FFMPEG" -nostdin -loglevel error -y \
      -f lavfi -i "color=c=0x0f0f13:s=${VIDEO_W}x${CANVAS_H}:d=${CARD_SECS}" \
      -vf "$CARD_VF" -pix_fmt yuv420p -r 30 "$CARD" 2>/dev/null \
    && "$FFMPEG" -nostdin -loglevel error -y -i "$CARD" -i "$CAPTIONED" \
      -filter_complex "[0:v]scale=${VIDEO_W}:${CANVAS_H},setsar=1,fps=30[a];[1:v]scale=${VIDEO_W}:${CANVAS_H},setsar=1,fps=30[b];[a][b]concat=n=2:v=1[v]" \
      -map "[v]" -pix_fmt yuv420p -crf 26 "$TITLED" 2>/dev/null \
    && [[ -s "$TITLED" ]]; then
    SEND="$TITLED"
  elif [[ -s "$CAPTIONED" && "$CAPTIONED" != "$OUT" ]]; then
    # Captions landed but the card did not; attach what we have rather than nothing.
    echo "  ⚠️ title card failed — attaching the captioned clip without it" >&2
    SEND="$CAPTIONED"
  else
    echo "  ⚠️ narration failed — attaching the raw recording" >&2
  fi

  # Reported in KB below a megabyte: re-encoding routinely lands these under 1 MB, and integer
  # division rendered that as "0MB", which reads like something went wrong.
  NEW_KB=$(( $(stat -f%z "$SEND") / 1024 ))
  NEW_MB=$(( NEW_KB / 1024 ))
  if (( NEW_MB >= 1 )); then echo "▶ narrated: ${NEW_MB}MB"; else echo "▶ narrated: ${NEW_KB}KB"; fi
  if (( NEW_MB >= 50 )); then
    echo "narrated clip is ${NEW_MB}MB; Linear rejects uploads at or over 50MB." >&2
    echo "  falling back to the raw recording (${SIZE_MB}MB)" >&2
    SEND="$OUT"
  fi
fi

# ── Publish ─────────────────────────────────────────────────────────────────────────────────────
#
# The clip goes on the Linear issue rather than to a chat. It outlives the PR that produced it, and
# the person deciding whether to merge is already reading the issue. `--pr` is optional: the demo is
# often recorded before the PR exists, and the uploader links it later.
echo "▶ attaching to $ISSUE"
ATTACH_ARGS=("$ISSUE" "$SEND" --caption "$CAPTION")
if [[ -n "${PR_NUMBER:-}" ]]; then
  ATTACH_ARGS+=(--pr "$PR_NUMBER" --repo gastosai-mobile)
fi
python3 "$ATTACH" "${ATTACH_ARGS[@]}"

echo "✔ attached: $CAPTION"
exit "$FLOW_STATUS"

# Maestro flows

End-to-end flows that tap the app the way a person does.

These exist because the pre-PR checklist (`ai/skills/shared/pre-pr-checklist.md` §6) requires
flows to be *exercised*, not just rendered — and rendering was all that was previously possible
here. Driving the simulator via AppleScript needs macOS Accessibility permission, which is
granted per *controlling application*: giving it to a terminal lets that terminal puppet every
app on the machine. That is a poor trade for tapping a button.

Maestro talks to the simulator directly instead, so no such permission is involved.

## Running

These flows drive the app, not the backend directly — they only pass if the running app can
reach a real API. Bring up the local stack first (`../../docs/local-loop.md` §1 for the backend,
§3 for mobile), then:

```bash
# Backend on :8080, Metro on :8081, simulator booted with the app open
maestro test .maestro/
maestro test .maestro/quick-add.yaml     # a single flow
maestro studio                            # interactive inspector
```

Flows target Expo Go (`host.exp.Exponent`) because this project runs there rather than a
development build. If it ever moves to a dev build, only `appId` changes.

`launch.yaml` signs in when the stored JWT has expired, using `GASTOSAI_EMAIL` /
`GASTOSAI_PASSWORD`. Those default to the backend's local demo account; point them elsewhere with
`maestro test --env GASTOSAI_EMAIL=... --env GASTOSAI_PASSWORD=...`.

### Reaching the backend: LAN, not localhost

The simulator is its own machine — `localhost` inside it is the simulator, not the laptop running
the backend. Nothing in this directory sets the API address; the *app* resolves it, once, at
startup (`src/api/client.ts`), and every flow here just inherits whatever it picked:

- `EXPO_PUBLIC_API_URL_LOCAL` (defaulted to `http://localhost:8080` in `.env`) is read only in
  `__DEV__`, and its loopback host is swapped for the address Metro is actually being served
  from — the LAN IP, not the simulator's own loopback.
- That substitution needs Metro serving over the LAN, which is the default. Run `npm start`
  plain; `--tunnel` and USB debugging give the device no LAN address to substitute, and the app
  surfaces exactly that in its error text if you do.
- Nothing under `.maestro/` names an IP or a port for this reason — hard-coding one here would
  fight the detection in `client.ts` rather than rely on it, and would break the moment the
  laptop joined a different network.

If a flow's first assertion times out with "cannot reach the server", check the app is actually
signed in against the local backend before suspecting the flow — `../../docs/local-smoke.md`'s
mobile leg is the fastest way to confirm that independently of Maestro.

### Manual checks

Not everything here can run unattended against a simulator:

- **Taking an actual photo in `receipt.yaml`.** The simulator has no camera, so the flow
  automates the photo-*library* path (`choose-photo`) instead — same upload, same parse, same
  save, just a different picker. The camera path (`fab-add` → "Scan receipt", `scan-receipt`)
  shares that code after the picker returns, so it is a manual check on a physical device:
  confirm the camera opens, a photo can be taken, and the result reaches the same
  parse-and-confirm screen the library path exercises here.

## Conventions

- **Assert** on user-visible text: a flow should fail when the user's experience breaks, not when
  a prop is renamed.
- **Target** by `testID` wherever text is ambiguous, and say why in a comment. Three cases keep
  recurring here, and each one fails misleadingly — the tap "succeeds" and the flow dies later on
  an unrelated assertion:
  - the same string appears twice (Home's month total and a Recent row both render `₱177.00`, and
    only one of them is pressable);
  - a button's title is also the screen title (`Sign in`, where the header wins the match);
  - React Navigation tab labels are not reliably exposed as text nodes at all.
- **Wrap row labels in `.*`.** A `Pressable` with `accessibilityRole="button"` collapses
  everything inside it into one accessibility node, so a hub row reads as
  `", Recurring, Bills and subscriptions, "` — icon glyph, label, sub-label, chevron. A plain
  match on `"Recurring"` fails against a screen that renders perfectly.
- **Name destructive confirm buttons** after what they delete (`Delete goal`, not `Delete`). Every
  row carries its own `Delete` link, so a bare match hits the row *behind* the dialog and silently
  re-opens it rather than confirming. This is a UI rule as much as a test one — the dialog is
  clearer for it.
- **An amount can appear twice on one screen.** Home shows the month total *and* a matching Recent
  row; Expenses shows a day-header total *and* its only row. The duplicate is never pressable, so
  tapping the text silently does nothing and the flow dies a step later. Target rows by test id
  (`expense-row-first`, `recent-row-N`, `goal-menu-N`).
- **Assert on a screen you did not just leave.** After v0.7 the Recent card sits below seven
  dashboard cards, so flows that need a single expense should enter from the Expenses tab instead
  of scrolling Home.
- **Never assert on a string that is also the control you just tapped.** `goals.yaml` asserted
  `"New goal"` after tapping the *button* labelled "New goal" — it passed whether or not the sheet
  opened, and the real failure surfaced a step later as a confusing missing test id. Assert on
  something only the new screen renders.
- **`eraseText` before `inputText` in a field a re-run may have left populated** — `inputText`
  appends, so the second run searches for "CommuteCommute" and matches nothing.
- **`extendedWaitUntil` after switching to a tab you have not visited.** React Navigation mounts
  tabs lazily, so the first assertion after the first tap races the mount.
- **Never** target a row by an amount the flow then deletes. Amounts collide with real data;
  matching loosely on a round `₱175.00` is how a seeded expense was destroyed during bring-up.
  Rows are addressed positionally (`recent-row-0`) and the amount is re-checked on the edit screen
  before anything is deleted.
- Each flow cleans up what it creates, so runs are repeatable against a shared dev database.
- Keep flows short and single-purpose; a long flow that fails in the middle tells you little.

### Narration, in `demo/` flows only

A demo flow is filmed and sent to people with no context, so it carries its own captions:

- **`label: ">> …"` on a step becomes a caption** burned over the video for that step's duration.
  `record-demo.sh` reads the timings out of the Maestro run log afterwards, which is the only way
  they stay in sync — a chat turn takes anywhere from eight to sixty seconds, so any hand-written
  offset desynchronises on the next run. A caption holds until the *next* one starts, so label the
  beats you want, not every step.
- **`# @watch <line>` in the flow's header** becomes a "watch for" bullet on the title card. It
  lives with the flow so it is neither retyped nor forgotten on each invocation.
- **Plain ASCII, and no `%`.** Captions are drawn by ffmpeg's `drawtext`, whose font has no glyph for
  `₱` or for arrows — a missing glyph renders as an empty box, on camera, in front of a client, which
  is why the marker is `>>` and not `▸`. `%` is worth avoiding separately: `drawtext` expands
  `%{…}` sequences in the text it is given. Write "40 percent".
- Punctuation is otherwise safe. The caption text reaches ffmpeg through `textfile=`, never as a
  filtergraph argument, so `:` and `'` need no escaping — the file is the escaping.
- **The last caption holds to the end of the clip**, so give the closing beat its own label rather
  than letting the previous one sit over an unrelated screen.

## iOS specifics that cost time to learn

- `- back` is Android's hardware button and is a no-op here.
- `textTransform: "uppercase"` changes only how text is drawn, not what is queryable.
- Maestro matches whole text nodes, so a label inside a sentence needs `.*` either side.
- The `decimal-pad` keyboard has no return key and covers the Save button — dismiss it via the
  form's `amount-done` accessory before tapping Save, or the tap lands on a digit and silently
  changes the amount being saved.
- iOS's "Save Password?" sheet is drawn over the app and swallows the next tap; `launch.yaml`
  dismisses it.
- Never assert on an AI-generated description. The parser rewrites what was typed.

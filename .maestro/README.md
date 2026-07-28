# Maestro flows

End-to-end flows that tap the app the way a person does.

These exist because the pre-PR checklist (`ai/skills/shared/pre-pr-checklist.md` §6) requires
flows to be *exercised*, not just rendered — and rendering was all that was previously possible
here. Driving the simulator via AppleScript needs macOS Accessibility permission, which is
granted per *controlling application*: giving it to a terminal lets that terminal puppet every
app on the machine. That is a poor trade for tapping a button.

Maestro talks to the simulator directly instead, so no such permission is involved.

## Running

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

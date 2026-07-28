import { describe, expect, it } from "@jest/globals";
import { unreadCount } from "./alerts";
import type { AlertResponse } from "./types";

const alert = (over: Partial<AlertResponse>): AlertResponse =>
  ({ id: 1, message: "m", read: false, dismissed: false, ...over }) as AlertResponse;

/**
 * `unreadCount` badges the More tab, so getting it wrong is either a badge that never clears or
 * one that never appears. It is also the only piece of derivation this client does over alerts —
 * everything else about them is decided server-side — so it is worth pinning exactly.
 */
describe("unreadCount", () => {
  it("counts only alerts that are unread and not dismissed", () => {
    expect(
      unreadCount([
        alert({ id: 1, read: false, dismissed: false }),
        alert({ id: 2, read: true, dismissed: false }),
        // Dismissed-but-unread must not count: dismissing is how a user clears an alert they
        // never opened, and a badge that survives it can never be cleared.
        alert({ id: 3, read: false, dismissed: true }),
        alert({ id: 4, read: true, dismissed: true }),
      ]),
    ).toBe(1);
  });

  it("treats missing flags as unread rather than assuming", () => {
    // The contract marks `read` and `dismissed` optional. Absent should surface the alert, not
    // hide it — failing to badge a real alert is worse than badging one already seen.
    expect(unreadCount([alert({ read: undefined, dismissed: undefined })])).toBe(1);
  });

  it("is zero for an empty list and for data that has not loaded", () => {
    expect(unreadCount([])).toBe(0);
    expect(unreadCount(undefined)).toBe(0);
  });
});

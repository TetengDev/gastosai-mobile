import * as SecureStore from "expo-secure-store";

// SecureStore keys allow only alphanumerics, ".", "-" and "_" — hence hyphenated event names.
const PREFIX = "ga.celebrate.";

/**
 * The flag is per account, so a second user on the same device still gets their own
 * celebrations and the first does not get theirs replayed on signing back in. The account is
 * folded to an FNV-1a hash rather than written into the key: the key stays opaque and inside
 * SecureStore's character rule whatever the email contains. A collision only means one skipped
 * cheer.
 */
export function celebrationKey(account: string, event: string): string {
  let h = 0x811c9dc5;
  for (const ch of account.trim().toLowerCase()) {
    h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193);
  }
  return `${PREFIX}${(h >>> 0).toString(16).padStart(8, "0")}.${event}`;
}

/**
 * Whether a celebration has played. A store failure answers "yes": skipping one is harmless,
 * replaying one on every launch is what this exists to prevent. SecureStore is used because it
 * is already a dependency (`tokenStore.ts`), not because the flag is secret.
 */
export async function hasCelebrated(account: string, event: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(celebrationKey(account, event))) === "1";
  } catch {
    return true;
  }
}

export async function markCelebrated(account: string, event: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(celebrationKey(account, event), "1");
  } catch {
    // Unwritable means it may play again next launch; that is the lesser failure.
  }
}

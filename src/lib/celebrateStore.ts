import * as SecureStore from "expo-secure-store";

// SecureStore keys allow only alphanumerics, ".", "-" and "_" — hence hyphenated event names.
const PREFIX = "ga.celebrate.";

/**
 * Whether a celebration has played. A store failure answers "yes": skipping one is harmless,
 * replaying one on every launch is what this exists to prevent. SecureStore is used because it
 * is already a dependency (`tokenStore.ts`), not because the flag is secret.
 */
export async function hasCelebrated(event: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PREFIX + event)) === "1";
  } catch {
    return true;
  }
}

export async function markCelebrated(event: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFIX + event, "1");
  } catch {
    // Unwritable means it may play again next launch; that is the lesser failure.
  }
}

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the JWT lives.
 *
 * The web app keeps its token in `localStorage`. The naive port of that to React Native is
 * `AsyncStorage`, which writes **plaintext to the app's sandbox** — readable on a rooted or
 * jailbroken device, and in a device backup. A shipped binary is fully inspectable, so the
 * only credential that may exist on-device is the user's own session token, and it belongs in
 * hardware-backed storage.
 *
 * `expo-secure-store` is the iOS Keychain and the Android Keystore. This is the single most
 * important thing not to copy verbatim from `gastosai-web/src/context/AuthContext.tsx`.
 *
 * Expo Go on web has no SecureStore; the fallback there is memory-only and deliberately does
 * not persist, so a developer previewing on web never gets a token written to `localStorage`.
 */

const TOKEN_KEY = "gastosai.jwt";
const USER_KEY = "gastosai.user";

const memoryFallback = new Map<string, string>();
const useSecureStore = Platform.OS !== "web";

async function setItem(key: string, value: string): Promise<void> {
  if (!useSecureStore) {
    memoryFallback.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getItem(key: string): Promise<string | null> {
  if (!useSecureStore) return memoryFallback.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (!useSecureStore) {
    memoryFallback.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface StoredUser {
  id?: number;
  email?: string;
  name?: string;
  role?: string;
}

export const tokenStore = {
  getToken: () => getItem(TOKEN_KEY),
  setToken: (token: string) => setItem(TOKEN_KEY, token),

  async getUser(): Promise<StoredUser | null> {
    const raw = await getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      // A corrupt entry must not wedge the app into a permanent broken-session state.
      await removeItem(USER_KEY);
      return null;
    }
  },

  setUser: (user: StoredUser) => setItem(USER_KEY, JSON.stringify(user)),

  async clear(): Promise<void> {
    await Promise.all([removeItem(TOKEN_KEY), removeItem(USER_KEY)]);
  },
};

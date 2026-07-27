import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import { tokenStore } from "../lib/tokenStore";

/**
 * The only hand-written API transport in this repo.
 *
 * Everything typed flows through `src/api/generated/` (see CONTRACT.md) — this file owns base
 * URL, auth header injection and error surfacing, nothing else. No request or response type is
 * declared here.
 */

/**
 * `localhost` is the device itself, not the dev machine, so a physical phone or an Android
 * emulator cannot reach a backend on your laptop that way. Falling back to the Expo host's IP
 * makes `npm start` work on a real device without hand-editing an env file.
 */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const lanHost = hostUri?.split(":")[0];
  if (lanHost && lanHost !== "localhost" && lanHost !== "127.0.0.1") {
    return `http://${lanHost}:8080`;
  }
  return configured ?? "http://localhost:8080";
}

export const API_BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Called when the server rejects the session. Set by the auth layer so this module does not
 * need to know about navigation — keeping the transport free of app wiring.
 */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      await tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/**
 * Turns an axios failure into something worth showing a user.
 *
 * The backend returns RFC 7807 problem details (`{title, detail, status}`), so prefer `detail`;
 * fall back to a network message rather than leaking an axios stack into the UI.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; title?: string; message?: string } | undefined;
    const fromBody = data?.detail ?? data?.message ?? data?.title;
    if (fromBody) return fromBody;
    if (!error.response) return "Cannot reach the server. Check your connection.";
  }
  return fallback;
}

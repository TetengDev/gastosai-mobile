import { describe, expect, it, jest } from "@jest/globals";
import type { InternalAxiosRequestConfig } from "axios";
// jest.mock calls below are hoisted above these imports by babel-jest, so the mocks still apply.
import { api, APP_PLATFORM, APP_VERSION, errorMessage } from "./client";

jest.mock("../lib/tokenStore", () => ({
  tokenStore: { getToken: async () => "test-jwt", clear: async () => {} },
}));

// jest-expo does not populate Constants.expoConfig, so without this the version would read
// "unknown" and the assertion below would only be testing the fallback. Mocking the real source
// is what makes this a test of the wiring rather than of the default.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "9.9.9" }, expoGoConfig: null },
}));


/** Runs the registered request interceptor the way axios would, and returns the final config. */
async function runRequestInterceptor(): Promise<InternalAxiosRequestConfig> {
  // axios keeps registered handlers on the manager; there is no public "apply" API.
  const handlers = (
    api.interceptors.request as unknown as {
      handlers: { fulfilled: (c: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig> }[];
    }
  ).handlers.filter(Boolean);

  let config = { headers: {} } as unknown as InternalAxiosRequestConfig;
  for (const h of handlers) config = await h.fulfilled(config);
  return config;
}

describe("request headers", () => {
  it("reports the app version on every request", async () => {
    // CONTRACT.md makes mobile the pacing constraint for breaking API changes: a /api/v1
    // endpoint cannot be retired until old installs have drained, and that is only answerable
    // if shipped builds identify themselves. A binary already in the wild can never be
    // retrofitted, so losing this header silently would be expensive and invisible.
    const config = await runRequestInterceptor();

    expect(config.headers["X-App-Version"]).toBe(APP_VERSION);
    expect(config.headers["X-App-Platform"]).toBe(APP_PLATFORM);
    // Proves the value comes from the Expo config, not the fallback.
    expect(APP_VERSION).toBe("9.9.9");
  });

  it("attaches the bearer token", async () => {
    const config = await runRequestInterceptor();
    expect(config.headers.Authorization).toBe("Bearer test-jwt");
  });
});

describe("errorMessage", () => {
  it("prefers the backend's RFC 7807 detail", () => {
    const err = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { status: 400, data: { title: "Bad Request", detail: "Amount must be positive." } },
    });
    expect(errorMessage(err)).toBe("Amount must be positive.");
  });

  it("explains a network failure rather than leaking axios internals", () => {
    const err = Object.assign(new Error("Network Error"), { isAxiosError: true, response: undefined });
    expect(errorMessage(err)).toBe("Cannot reach the server. Check your connection.");
  });

  it("falls back for a non-axios error", () => {
    expect(errorMessage(new Error("boom"), "Could not save.")).toBe("Could not save.");
  });
});

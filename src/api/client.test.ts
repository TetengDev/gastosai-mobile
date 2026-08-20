import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { InternalAxiosRequestConfig } from "axios";
// jest.mock calls below are hoisted above these imports by babel-jest, so the mocks still apply.
import {
  api,
  APP_PLATFORM,
  APP_VERSION,
  errorMessage,
  isPaywallMessage,
  paywall,
  UPGRADE_PROMPT,
} from "./client";

jest.mock("../lib/tokenStore", () => ({
  tokenStore: { getToken: async () => "test-jwt", clear: async () => {} },
}));

/**
 * The address Expo is serving the bundle from, as the base-URL tests below vary it.
 *
 * It has to be a getter over a mutable binding rather than a `jest.doMock` per case: the hoisted
 * `jest.mock` above wins over a later `doMock` of the same module, so re-registering inside
 * `isolateModules` silently has no effect and every case sees no host at all. The `mock` name
 * prefix is what permits the factory to close over an outer variable.
 */
let mockHostUri: string | undefined;

// jest-expo does not populate Constants.expoConfig, so without this the version would read
// "unknown" and the assertion below would only be testing the fallback. Mocking the real source
// is what makes this a test of the wiring rather than of the default.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: "9.9.9",
      get hostUri() {
        return mockHostUri;
      },
    },
    expoGoConfig: null,
  },
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

/** A 402 as the backend actually sends it: an RFC 7807 body, plus `feature` on a plan gate. */
function gateError(data: Record<string, unknown>) {
  return Object.assign(new Error("Request failed with status code 402"), {
    isAxiosError: true,
    response: { status: 402, data },
  });
}

describe("paywall", () => {
  it("names the feature instead of echoing the enum the server sent", () => {
    // The annotation-driven gate's default detail is literally
    // "This feature requires an upgraded plan: NL_CHATBOT". Showing a user an enum name is the
    // failure this issue exists to remove, and it is a *specific* message, so it would sail past
    // any check that only looks for a generic one.
    const gate = paywall(
      gateError({
        title: "Upgrade Required",
        detail: "This feature requires an upgraded plan: NL_CHATBOT",
        feature: "NL_CHATBOT",
      }),
    );

    expect(gate).toEqual({
      kind: "plan",
      feature: "NL_CHATBOT",
      message: `Ask AI is not included in your plan. ${UPGRADE_PROMPT}`,
    });
    expect(gate?.message).not.toContain("NL_CHATBOT");
  });

  it("keeps a hand-written detail, which carries a fact this app cannot know", () => {
    // The category cap comes from server configuration. "limited to 5" is worth more than
    // anything this file could write, so a detail that is not just the enum restated is kept.
    const gate = paywall(
      gateError({
        detail: "Your plan is limited to 5 categories. Upgrade to add more.",
        feature: "CUSTOM_CATEGORIES",
      }),
    );

    expect(gate?.message).toBe(
      `Your plan is limited to 5 categories. Upgrade to add more. ${UPGRADE_PROMPT}`,
    );
  });

  it("degrades to honest generic copy for a feature key this build predates", () => {
    // CLAUDE.md §1.5: installed apps meet server-side values newer than the build. The one thing
    // that must not happen is the enum reaching the screen.
    const gate = paywall(
      gateError({
        detail: "This feature requires an upgraded plan: SOMETHING_NEW",
        feature: "SOMETHING_NEW",
      }),
    );

    expect(gate?.message).toBe(`This feature is not included in your plan. ${UPGRADE_PROMPT}`);
    expect(gate?.message).not.toContain("SOMETHING_NEW");
  });

  it("does not offer an upgrade for a missing AI key, which upgrading would not fix", () => {
    // /ai/** answers 402 through the bring-your-own-key interceptor, which sends no `feature`.
    // Selling a plan here would take someone's money and leave them exactly as stuck.
    const gate = paywall(
      gateError({
        title: "AI key required",
        detail: "Add your OpenAI key in Settings to use AI features.",
      }),
    );

    expect(gate).toEqual({
      kind: "ai-key",
      feature: null,
      message: "Add your OpenAI key in Settings to use AI features.",
    });
    expect(isPaywallMessage(gate?.message)).toBe(false);
  });

  it("still says something when a 402 arrives with no body at all", () => {
    expect(paywall(gateError({}))?.message).toBe(
      "AI features are unavailable on this account right now.",
    );
  });

  it("ignores anything that is not a 402", () => {
    const err = Object.assign(new Error("nope"), {
      isAxiosError: true,
      response: { status: 403, data: { feature: "NL_CHATBOT" } },
    });
    expect(paywall(err)).toBeNull();
    expect(paywall(new Error("boom"))).toBeNull();
  });
});

describe("errorMessage on a gated request", () => {
  // This is the whole coverage argument. Every screen renders `errorMessage(error)`, so answering
  // 402 here — ahead of the fallback — is what makes "no 402 surfaces as a generic unexpected
  // error" true everywhere at once, including endpoints gated after this was written.
  it("explains the gate rather than using the caller's fallback", () => {
    const err = gateError({
      detail: "This feature requires an upgraded plan: ADVANCED_INSIGHTS",
      feature: "ADVANCED_INSIGHTS",
    });

    const message = errorMessage(err, "Could not read that receipt. Try a clearer photo.");

    expect(message).toBe(`Spending insights is not included in your plan. ${UPGRADE_PROMPT}`);
    // The suffix is the contract with ErrorText: it is how the string is recognised as a paywall
    // once the error object is gone. Breaking it silently removes the upgrade button app-wide.
    expect(isPaywallMessage(message)).toBe(true);
  });
});

/**
 * `resolveBaseUrl` runs once, at import time, off `__DEV__`, the Expo host URI and two env vars.
 * None of that is injectable after the fact, so each case re-imports the module in a fresh
 * registry with those three inputs set — which is also the only way to observe `IS_LOCAL_BACKEND`
 * and the timeout, both of which are frozen at the same moment.
 */
type ClientModule = typeof import("./client");

const originalEnv = { ...process.env };
const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

function loadClient(opts: {
  dev: boolean;
  /** What the bundle was served from: a LAN address, `localhost` (tunnel/USB), or nothing. */
  hostUri?: string | null;
  apiUrl?: string;
  localUrl?: string;
}): ClientModule {
  (globalThis as { __DEV__?: boolean }).__DEV__ = opts.dev;
  mockHostUri = opts.hostUri ?? undefined;

  // Deleting rather than setting "" matters: the code trims and checks truthiness, so an empty
  // string and an absent variable must both fall through, and a leaked value from the real
  // environment would silently decide the test.
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_API_URL_LOCAL;
  if (opts.apiUrl !== undefined) process.env.EXPO_PUBLIC_API_URL = opts.apiUrl;
  if (opts.localUrl !== undefined) process.env.EXPO_PUBLIC_API_URL_LOCAL = opts.localUrl;

  let mod!: ClientModule;
  // `import()` survives babel-preset-expo as a real dynamic import, which jest's CJS runtime
  // refuses; the synchronous pair is what actually gets a fresh registry here.
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("./client") as ClientModule;
  });
  return mod;
}

afterEach(() => {
  process.env = { ...originalEnv };
  (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
});

describe("base URL resolution", () => {
  const LAN = "192.168.1.14:8081";

  it("detects the laptop's LAN address in development with nothing configured", () => {
    // The acceptance case for `npm start` on a real phone: no env file, and the address is the
    // one the bundle arrived over, so it is right on whatever network the developer is on today.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({ dev: true, hostUri: LAN });

    expect(API_BASE_URL).toBe("http://192.168.1.14:8080");
    expect(IS_LOCAL_BACKEND).toBe(true);
  });

  it("prefers EXPO_PUBLIC_API_URL_LOCAL, swapping its loopback host for the LAN address", () => {
    // Someone running the backend on a non-default port writes `localhost:9090` because that is
    // what works on their laptop. On the phone `localhost` is the phone, so the host — and only
    // the host — is substituted; port and scheme are theirs.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({
      dev: true,
      hostUri: LAN,
      localUrl: "http://localhost:9090/",
    });

    expect(API_BASE_URL).toBe("http://192.168.1.14:9090");
    expect(IS_LOCAL_BACKEND).toBe(true);
  });

  it("leaves an explicit non-loopback EXPO_PUBLIC_API_URL_LOCAL alone", () => {
    // The escape hatch for a machine with several active networks, where detection picks the
    // wrong interface. If it were still rewritten, there would be no way to overrule detection.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({
      dev: true,
      hostUri: LAN,
      localUrl: "https://gastos.example.ngrok.app",
    });

    expect(API_BASE_URL).toBe("https://gastos.example.ngrok.app");
    expect(IS_LOCAL_BACKEND).toBe(true);
  });

  it("ignores a loopback host URI, since that is the device and not the laptop", () => {
    // Tunnel mode and a USB-forwarded emulator both serve over localhost. There is nothing to
    // detect, so it must not claim to have detected one.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({ dev: true, hostUri: "localhost:8081" });

    expect(API_BASE_URL).toBe("http://localhost:8080");
    expect(IS_LOCAL_BACKEND).toBe(false);
  });

  it("says the address is the device when a loopback override has no LAN address to swap in", () => {
    // The `.env.example` value, in tunnel mode. `localhost:9090` is what works on the laptop, so
    // it is what people write; with nothing to substitute it survives and the phone asks itself.
    // The ordinary local message ("check the API is running, check the network") is wrong advice
    // here — both are fine — so this case has to be told apart rather than lumped in.
    const { API_BASE_URL, errorMessage: message } = loadClient({
      dev: true,
      hostUri: "localhost:8081",
      localUrl: "http://localhost:9090",
    });

    expect(API_BASE_URL).toBe("http://localhost:9090");

    const noResponse = Object.assign(new Error("Network Error"), {
      isAxiosError: true,
      response: undefined,
    });

    expect(message(noResponse)).toContain("which is this device, not your laptop");
    expect(message(noResponse)).toContain("set it to your laptop's LAN address in full");
  });

  it("does not mistake a hostname merely starting with localhost for the device", () => {
    // `localhost.example.com` is a real, routable host. Matching it as loopback would hand the
    // developer the tunnel-mode advice for a machine that is not theirs.
    const { API_BASE_URL, errorMessage: message } = loadClient({
      dev: true,
      hostUri: "localhost:8081",
      localUrl: "http://localhost.example.com:9090",
    });

    expect(API_BASE_URL).toBe("http://localhost.example.com:9090");

    const noResponse = Object.assign(new Error("Network Error"), {
      isAxiosError: true,
      response: undefined,
    });

    expect(message(noResponse)).toBe(
      "Cannot reach the local backend at http://localhost.example.com:9090. " +
        "Check the API is running and that this device is on the same network.",
    );
  });

  it("ignores EXPO_PUBLIC_API_URL_LOCAL outside development", () => {
    // EXPO_PUBLIC_* is inlined at build time, so a build machine that happened to have the local
    // override set would otherwise ship an app pointed at someone's laptop.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({
      dev: false,
      hostUri: LAN,
      apiUrl: "https://api.gastosai.app",
      localUrl: "http://localhost:9090",
    });

    expect(API_BASE_URL).toBe("https://api.gastosai.app");
    expect(IS_LOCAL_BACKEND).toBe(false);
  });

  it("uses EXPO_PUBLIC_API_URL verbatim in a build, with no host substitution", () => {
    // A shipped app retargeting itself at a host nobody chose is a worse failure than a wrong URL.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({
      dev: false,
      hostUri: LAN,
      apiUrl: "http://localhost:8080",
    });

    expect(API_BASE_URL).toBe("http://localhost:8080");
    expect(IS_LOCAL_BACKEND).toBe(false);
  });

  it("lets detection outrank a configured EXPO_PUBLIC_API_URL in development", () => {
    // The sharp edge of the ordering, and deliberate: a developer whose .env points at a
    // deployed API still gets their own laptop under `npm start`, because that is what a dev
    // session is for. Reaching anything else from dev goes through EXPO_PUBLIC_API_URL_LOCAL.
    const { API_BASE_URL, IS_LOCAL_BACKEND } = loadClient({
      dev: true,
      hostUri: LAN,
      apiUrl: "https://api.gastosai.app",
    });

    expect(API_BASE_URL).toBe("http://192.168.1.14:8080");
    expect(IS_LOCAL_BACKEND).toBe(true);
  });

  it("does not treat a remote EXPO_PUBLIC_API_URL as local when there is nothing to detect", () => {
    // Tunnel mode, so no LAN host to prefer: the configured URL is used, and nothing was
    // substituted, so nothing says this is the laptop. Calling it local would put the 8s timeout
    // and the "check the API is running" message on a real server — both wrong advice.
    const { API_BASE_URL, IS_LOCAL_BACKEND, api: client } = loadClient({
      dev: true,
      hostUri: "localhost:8081",
      apiUrl: "https://api.gastosai.app",
    });

    expect(API_BASE_URL).toBe("https://api.gastosai.app");
    expect(IS_LOCAL_BACKEND).toBe(false);
    expect(client.defaults.timeout).toBe(20_000);
  });
});

describe("the unreachable laptop", () => {
  it("fails fast and names the address instead of blaming the phone's connection", () => {
    // The failure this loop actually produces is a hang, not a refusal: a sleeping laptop sends
    // nothing back to reject. A short timeout is what turns that into an error at all, and the
    // address is what stops the developer from debugging their phone's wifi.
    const { errorMessage: message, api: client } = loadClient({
      dev: true,
      hostUri: "192.168.1.14:8081",
    });

    expect(client.defaults.timeout).toBe(8_000);

    const timedOut = Object.assign(new Error("timeout of 8000ms exceeded"), {
      isAxiosError: true,
      code: "ECONNABORTED",
      response: undefined,
    });

    expect(message(timedOut)).toBe(
      "Cannot reach the local backend at http://192.168.1.14:8080. " +
        "Check the API is running and that this device is on the same network.",
    );
  });
});

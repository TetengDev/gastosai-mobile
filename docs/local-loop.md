# The local loop — the app on a real phone, against the backend on your laptop

Verifying a mobile change should not require a build. It doesn't: Expo Go loads the bundle from
the dev server on your machine, and this document is about the other half — getting the app's
**API calls** to land on the backend running beside it.

The end-to-end path from three empty checkouts (Postgres, backend, web, mobile, seeded accounts)
is `../../gastosai-app/docs/local-loop.md`. This file covers only what is specific to mobile:
how `src/api/client.ts` decides on a base URL, how to override it, and what the failures look
like. Deployment is deferred — no EAS build, no store submission, milestone `M5`.

---

## The problem in one line

`http://localhost:8080` is correct on your laptop and wrong on your phone. `localhost` on a
device is **the device**, so the request leaves the app, finds nothing, and the screen sits
there. The same is true of the Android emulator. The backend has to be addressed by the
laptop's LAN IP — which changes every time you join a different network, and which
`EXPO_PUBLIC_*` cannot hold, because those are frozen into the bundle at build time.

So the address is **discovered at runtime, not configured**.

## How the base URL is resolved

`resolveBaseUrl()` in `src/api/client.ts`, in order:

| # | Condition | Result |
|---|---|---|
| 1 | `__DEV__` and `EXPO_PUBLIC_API_URL_LOCAL` is set | That URL, with a loopback host swapped for the Expo dev server's LAN address |
| 2 | `__DEV__` and Expo is serving over a LAN address | `http://<that address>:8080` |
| 3 | `EXPO_PUBLIC_API_URL` is set | Used **verbatim** — no detection, no rewriting |
| 4 | nothing set | `http://localhost:8080` |

Read the order literally: in development, rule 2 fires before rule 3, so a `.env` pointing
`EXPO_PUBLIC_API_URL` at a deployed API still gets your own laptop under `npm start`. That is
what a dev session is for. To reach something else from development, use rule 1.

The LAN address comes from `Constants.expoConfig.hostUri` — the packager connection the bundle
arrived over. It is read when the app starts, so it is right on whatever network you are on
today and appears in no build artifact.

Rules 1 and 2 are inside `if (__DEV__)`. A release bundle takes rule 3 and only rule 3: there is
no dev server to ask, and an installed app silently retargeting itself at a host nobody chose
would be a worse bug than a wrong URL. `EXPO_PUBLIC_API_URL_LOCAL` is ignored in a build even if
the build machine happened to have it set.

## Doing it

Backend answering on `:8080` (see the workspace doc), phone on the same Wi-Fi as your laptop:

```bash
npm start        # then scan the QR code in Expo Go
```

That is the whole setup. Rule 2 handles a physical device and an Android emulator without an
env file, because the bundle already came from the LAN address the API is on.

On boot the app logs the address it settled on, so you never have to guess:

```
[api] base URL http://192.168.1.14:8080 (local)
```

### When you need `EXPO_PUBLIC_API_URL_LOCAL`

Set it in `.env` (Expo loads it; `EXPO_PUBLIC_*` only, nothing secret — a bundle is fully
inspectable) when auto-detection is not what you want:

```bash
# Backend on a non-default port. The host is still auto-detected — a loopback host in this
# value is replaced with the LAN address, so this works from a phone as written.
# The exception is tunnel mode, where there is no LAN address to substitute and `localhost`
# survives as the phone itself; the app says so by name if a request then fails.
EXPO_PUBLIC_API_URL_LOCAL=http://localhost:9090

# A specific interface, when your machine has several active networks and rule 2 picks the
# wrong one. Written out in full, nothing is substituted.
EXPO_PUBLIC_API_URL_LOCAL=http://192.168.1.14:8080

# A teammate's backend, or a tunnel.
EXPO_PUBLIC_API_URL_LOCAL=https://gastos.example.ngrok.app
```

Restart `npm start` after changing it — the value is inlined when the bundle is built, so a
fast refresh will not pick it up.

`.env.example` carries the same variable, commented out.

## Verifying it

1. `npm start`, open in Expo Go, watch for the `[api] base URL` line.
2. Sign in with a seeded account (`premium@gastosai.dev` / `premium123`).
3. Open **Expenses** — the same 15 seeded rows the web app shows.

Sign-in is the useful check rather than a health endpoint: it is a POST that needs a body, a
response and a token written to the Keychain, so it exercises the transport end to end.

## When it doesn't work

The failure mode this loop actually produces is not a refused connection — it's a **hang**. A
laptop that is asleep, on another network, or simply not running the API doesn't answer with
anything to reject; the packets go nowhere. Two things in `client.ts` exist for that:

- **The timeout drops to 8s** when the base URL is local (20s otherwise). A local round trip is
  a few milliseconds, so nothing real is lost, and a screen that fails in eight seconds reads as
  broken rather than as frozen.
- **The message names the address.** A response-less failure against a local backend says
  *"Cannot reach the local backend at http://192.168.1.14:8080…"*, not *"check your
  connection"* — which would send you to look at your phone's wifi when the phone is fine.

| What you see | Usually |
|---|---|
| "Cannot reach the local backend at `http://192.168.1.14:8080`" | Backend not running, or `./mvnw spring-boot:run` died. Check the laptop first. |
| Same message, but the IP is not your laptop's | Rule 2 picked the wrong interface — VPN, or a second active network. Set `EXPO_PUBLIC_API_URL_LOCAL` explicitly. |
| Logged base URL is `http://localhost:8080` on a device | Expo is serving over `localhost` (tunnel mode, or a USB-forwarded emulator). Set `EXPO_PUBLIC_API_URL_LOCAL` explicitly. |
| "…is `http://localhost:9090`, which is this device, not your laptop" | You set a loopback `EXPO_PUBLIC_API_URL_LOCAL` *and* Expo is in tunnel mode, so there was no LAN address to substitute into it. Write the address out in full. |
| "Cannot reach the server. Check your connection." | The base URL is **not** local — you have `EXPO_PUBLIC_API_URL` pointing somewhere remote. |
| Sign-in reaches the API but hangs on the AI screens | Not this — `/ai/chat` and `/ai/vision` set their own 90s timeout. See `docs/lessons.md`. |
| Phone can't even load the bundle | Not an API problem. Client isolation on the Wi-Fi, or a firewall on the Expo port. |

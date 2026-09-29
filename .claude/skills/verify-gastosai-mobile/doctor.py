#!/usr/bin/env python3
"""Is this simulator worth driving? Read-only check for the mobile verification loop.

    python3 .claude/skills/verify-gastosai-mobile/doctor.py

Starts nothing, installs nothing, taps nothing. It answers the question a failed Maestro flow
cannot: whether the failure is the app's or the loop's. Six things have to hold, and each one has
failed here in a way that read like a broken app:

- **Maestro installed**, at a version that still speaks to this simulator's driver.
- **A booted iOS simulator**, and exactly one — Maestro picks by `--udid` otherwise, and with two
  booted it may drive the wrong one.
- **Expo Go present on it** (`host.exp.Exponent`), which is the `appId` every flow names. A
  development build would answer to a different id and nothing under `.maestro/` would match.
- **Metro serving over the LAN on :8081.** The app substitutes Metro's own host for the loopback
  address in `EXPO_PUBLIC_API_URL_LOCAL`, so a tunnel or USB session leaves it with no LAN address
  to use and every flow fails at its first assertion with "cannot reach the server".
- **The backend answering on :8080 from the LAN address**, not merely on loopback — that is the
  address the app will actually call from inside the simulator.
- **The demo account signing in**, so a flow's `launch.yaml` can re-authenticate when the stored
  JWT has expired.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.request

EMAIL = os.environ.get("GASTOSAI_EMAIL", "demo@gastosai.dev")
PASSWORD = os.environ.get("GASTOSAI_PASSWORD", "demo123")


def sh(*cmd: str) -> str:
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def lan_ip() -> str:
    """The address Metro advertises and the app substitutes. No DNS, no outbound packet."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 1))  # TEST-NET-1: routable nowhere, so nothing is sent
        return s.getsockname()[0]
    except OSError:
        return ""
    finally:
        s.close()


def get(url: str, timeout: int = 4) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read(2000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except OSError:
        return 0, ""


def post_json(url: str, body: dict, timeout: int = 15) -> int:
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError:
        return 0


def main() -> int:
    rows: list[tuple[str, bool, str]] = []
    ip = lan_ip()

    maestro = shutil.which("maestro") or os.path.expanduser("~/.maestro/bin/maestro")
    version = sh(maestro, "--version").strip().splitlines()[-1] if os.path.exists(maestro) else ""
    rows.append((f"maestro {version or '(not found)'}", bool(version),
                 "curl -Ls install.maestro.mobile.dev | bash"))

    booted = [ln for ln in sh("xcrun", "simctl", "list", "devices", "booted").splitlines()
              if "(Booted)" in ln]
    names = ", ".join(re.sub(r"\s*\(.*", "", ln).strip() for ln in booted) or "(none)"
    rows.append((f"Simulator booted: {names}", len(booted) == 1,
                 "boot exactly one — two booted makes Maestro's pick ambiguous"))

    udid = ""
    if booted:
        m = re.search(r"\(([0-9A-F-]{36})\)", booted[0])
        udid = m.group(1) if m else ""
    apps = sh("xcrun", "simctl", "listapps", udid) if udid else ""
    rows.append(("Expo Go installed (host.exp.Exponent)", "host.exp.Exponent" in apps,
                 "install Expo Go on the simulator and open the project once"))

    metro_local, _ = get("http://localhost:8081/status")
    metro_lan, _ = get(f"http://{ip}:8081/status") if ip else (0, "")
    rows.append((f"Metro :8081 over the LAN ({ip or 'no LAN address'})",
                 metro_local == 200 and metro_lan == 200,
                 "npm start — plain, not --tunnel; the simulator cannot use a loopback Metro"))

    api_local, _ = get("http://localhost:8080/actuator/health")
    api_lan, _ = get(f"http://{ip}:8080/actuator/health") if ip else (0, "")
    rows.append((f"API :8080 reachable at {ip or '?'}", api_local == 200 and api_lan == 200,
                 "the app calls the LAN address, not loopback — check the host firewall"))

    login = post_json("http://localhost:8080/api/v2/auth/login",
                      {"email": EMAIL, "password": PASSWORD}) if api_local == 200 else 0
    rows.append((f"Sign-in for {EMAIL}", login == 200,
                 "429 = public rate limit (10/min); 401 = the account predates this .env"))

    width = max(len(r[0]) for r in rows)
    print()
    for name, ok, hint in rows:
        print(f"  {'PASS' if ok else 'FAIL'}  {name:<{width}}  {'' if ok else hint}")
    if udid:
        print(f"\n  udid {udid}")
    print("  flows inherit the API address from the app itself (src/api/client.ts); nothing under "
          ".maestro/ names an IP")
    return 0 if all(r[1] for r in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())

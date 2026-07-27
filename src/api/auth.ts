import { api } from "./client";
import type { AuthResponse, LoginRequest, RegisterRequest } from "./types";

/**
 * Auth calls. Magic-link is deliberately absent from v1: the emailed link points at
 * `FRONTEND_BASE_URL` (the web origin), so opening it in the app needs deep-link handling and a
 * backend that knows the mobile scheme. Email/password is the honest v1 boundary — see
 * KNOWN-GAPS.md.
 */

export const login = (body: LoginRequest) =>
  api.post<AuthResponse>("/auth/login", body).then((r) => r.data);

export const register = (body: RegisterRequest) =>
  api.post<AuthResponse>("/auth/register", body).then((r) => r.data);

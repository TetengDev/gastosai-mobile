import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest, register as registerRequest } from "../api/auth";
import { setUnauthorizedHandler } from "../api/client";
import { tokenStore, type StoredUser } from "../lib/tokenStore";
import type { LoginRequest, RegisterRequest } from "../api/types";

interface AuthState {
  user: StoredUser | null;
  /** Undefined until the stored session has been read — screens must not redirect before then. */
  ready: boolean;
  signIn: (body: LoginRequest) => Promise<void>;
  signUp: (body: RegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);

  // SecureStore is async, unlike the web's synchronous localStorage. Until the first read
  // resolves we genuinely do not know whether there is a session, so `ready` gates navigation
  // — otherwise every cold start would flash the login screen at an already-signed-in user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, stored] = await Promise.all([tokenStore.getToken(), tokenStore.getUser()]);
      if (!cancelled) {
        setUser(token ? stored : null);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  // A 401/403 anywhere means the session is gone; drop it here rather than in the transport.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persist = useCallback(async (res: Awaited<ReturnType<typeof loginRequest>>) => {
    if (!res.token) throw new Error("Sign-in succeeded but no token was returned.");
    const nextUser: StoredUser = { email: res.email, name: res.name, role: res.role };
    await tokenStore.setToken(res.token);
    await tokenStore.setUser(nextUser);
    setUser(nextUser);
  }, []);

  const signIn = useCallback(
    async (body: LoginRequest) => persist(await loginRequest(body)),
    [persist],
  );

  const signUp = useCallback(
    async (body: RegisterRequest) => persist(await registerRequest(body)),
    [persist],
  );

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut }),
    [user, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

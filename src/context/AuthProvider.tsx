import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/services/api";
import type { AuthUser } from "@/types";

import { useWallet } from "./WalletProvider";

export interface AuthState {
  user: AuthUser | null;
  /** True until the cookie has been checked once, so guards can wait. */
  initializing: boolean;
  /** True while a sign-in challenge is being requested and signed. */
  signingIn: boolean;
  error: string | null;
  /**
   * Runs the full sign-in: request a challenge, have the wallet sign it, hand
   * the signature back. The session cookie is set by the response.
   */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the session cookie, e.g. after the profile is edited. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Reads the session cookie and resolves to the signed-in user, or null.
 *
 * Split out from `refresh` so the mount effect stays a plain promise chain
 * instead of a synchronous setState, and so an unreachable API cannot be
 * mistaken for a signed-out user without the caller knowing.
 */
async function readSession(): Promise<AuthUser | null> {
  try {
    const session = await api.me();
    return session.authenticated ? session.user : null;
  } catch {
    return null;
  }
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { signer, address } = useWallet();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Re-reads the session, e.g. after the profile is edited. */
  const refresh = useCallback(async () => {
    setUser(await readSession());
    setInitializing(false);
  }, []);

  // The cookie outlives a page load, so the session is restored on mount rather
  // than re-established by signing again.
  useEffect(() => {
    void readSession().then((next) => {
      setUser(next);
      setInitializing(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!signer || !address) {
      setError("Connect a wallet first.");
      return;
    }

    setSigningIn(true);
    setError(null);
    try {
      const challenge = await api.requestNonce(address);
      // `message` goes to the signer untouched. Trimming or re-encoding it here
      // would invalidate the signature the server is going to check.
      const signed = await signer.signMessage(challenge.message);

      const result = await api.verifyChallenge({
        address,
        message: challenge.message,
        signature: signed,
      });

      setUser(result.authenticated ? result.user : null);
    } catch (cause) {
      setUser(null);
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }, [address, signer]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await api.logout();
    } catch {
      // The cookie is cleared by the browser on a best-effort basis; a failed
      // logout must not leave the UI claiming to be signed in.
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signingIn,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [user, initializing, signingIn, error, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Convenience guard: is the signed-in user's wallet the connected one? */
export function useIsConnectedWallet(): boolean {
  const { user } = useAuth();
  const { address } = useWallet();
  return Boolean(user && address && user.walletAddress === address);
}

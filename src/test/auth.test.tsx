import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/context/AuthProvider";
import type { AuthUser } from "@/types";

const ADDRESS = "ckt1qexampleaddress000000000000000000000";
/** Trailing space and inner newlines are deliberate: the message must survive. */
const MESSAGE =
  "CKB Credential sign-in\nckt1qexampleaddress000000000000000000000\nnonce: abc123\n";

const me = vi.fn();
const requestNonce = vi.fn();
const verifyChallenge = vi.fn();
const logout = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    me: (...args: unknown[]) => me(...args),
    requestNonce: (...args: unknown[]) => requestNonce(...args),
    verifyChallenge: (...args: unknown[]) => verifyChallenge(...args),
    logout: (...args: unknown[]) => logout(...args),
  },
}));

const signMessage = vi.fn();

/** Mutable so each test can pick connected / not connected. */
const wallet = {
  signer: undefined as
    | { signMessage: typeof signMessage }
    | undefined,
  address: ADDRESS as string | null,
  source: "joyid" as const,
  connecting: false,
  error: null as string | null,
  openConnector: vi.fn(),
  connectJoyId: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => wallet,
}));

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    walletAddress: ADDRESS,
    displayName: "Ada",
    avatarUrl: null,
    bio: null,
    organizationName: null,
    organizationType: null,
    ...over,
  };
}

function Harness() {
  const { user: current, initializing, error, signIn, signOut } = useAuth();

  if (initializing) return <p>restoring</p>;

  return (
    <div>
      <p data-testid="who">{current ? current.walletAddress : "anonymous"}</p>
      <p data-testid="error">{error ?? "none"}</p>
      <button type="button" onClick={() => void signIn()}>
        Sign in
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    me.mockReset().mockResolvedValue({ authenticated: false, user: null });
    requestNonce.mockReset();
    verifyChallenge.mockReset();
    logout.mockReset();
    signMessage.mockReset();
    wallet.signer = { signMessage };
    wallet.address = ADDRESS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the session from the cookie instead of asking for a signature", async () => {
    me.mockResolvedValue({ authenticated: true, user: user() });
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent(ADDRESS);
    });
    // A reload must never pop the wallet prompt again.
    expect(requestNonce).not.toHaveBeenCalled();
  });

  it("signs the challenge the server issued, byte for byte", async () => {
    const user_ = userEvent.setup();
    requestNonce.mockResolvedValue({
      message: MESSAGE,
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    const signature = {
      signature: "0xabc",
      identity: "0x02def",
      signType: "CkbSecp256k1",
    };
    signMessage.mockResolvedValue(signature);
    verifyChallenge.mockResolvedValue({
      authenticated: true,
      user: user(),
      expiresAt: "2026-01-02T00:00:00.000Z",
    });

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent("anonymous");
    });

    await user_.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent(ADDRESS);
    });

    expect(requestNonce).toHaveBeenCalledWith(ADDRESS);
    // Trimming or re-wrapping the message would produce a signature the
    // backend cannot verify against the stored challenge.
    expect(signMessage).toHaveBeenCalledWith(MESSAGE);
    expect(verifyChallenge).toHaveBeenCalledWith({
      address: ADDRESS,
      message: MESSAGE,
      signature,
    });
  });

  it("does not start a challenge when no wallet is connected", async () => {
    const user_ = userEvent.setup();
    wallet.signer = undefined;
    wallet.address = null;

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent("anonymous");
    });

    await user_.click(screen.getByRole("button", { name: "Sign in" }));

    expect(requestNonce).not.toHaveBeenCalled();
    expect(screen.getByTestId("error")).toHaveTextContent(
      /Connect a wallet/i,
    );
  });

  it("surfaces a rejected signature and stays signed out", async () => {
    const user_ = userEvent.setup();
    requestNonce.mockResolvedValue({
      message: MESSAGE,
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    signMessage.mockResolvedValue({
      signature: "0xdead",
      identity: "0x02beef",
      signType: "CkbSecp256k1",
    });
    verifyChallenge.mockRejectedValue(
      new Error("The signature does not match the challenge"),
    );

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent("anonymous");
    });

    await user_.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent(
        /does not match the challenge/i,
      );
    });
    expect(screen.getByTestId("who")).toHaveTextContent("anonymous");
  });

  it("ends the session on sign out even when the request fails", async () => {
    const user_ = userEvent.setup();
    me.mockResolvedValue({ authenticated: true, user: user() });
    // The cookie may already be gone; the UI must not keep claiming to be in.
    logout.mockRejectedValue(new Error("Network error"));

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent(ADDRESS);
    });

    await user_.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.getByTestId("who")).toHaveTextContent("anonymous");
    });
  });
});

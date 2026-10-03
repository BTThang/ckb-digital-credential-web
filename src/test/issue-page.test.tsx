import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/context/AuthProvider";
import IssuePage from "@/pages/IssuePage";
import type { AuthUser } from "@/types";

const ADDRESS = "ckt1qexampleaddress000000000000000000000";

const me = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    me: (...args: unknown[]) => me(...args),
  },
}));

vi.mock("@/services/credentials", () => ({
  issueCredential: vi.fn(),
}));

const wallet = {
  signer: {} as never,
  address: ADDRESS as string | null,
};

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => wallet,
}));

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 3,
    walletAddress: ADDRESS,
    displayName: "Ada Lovelace",
    avatarUrl: null,
    bio: null,
    organizationName: "Nervos Academy",
    organizationType: "school",
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <IssuePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function issuerNameInput() {
  return screen.getByLabelText(/Issuer name/i) as HTMLInputElement;
}

describe("IssuePage profile prefill", () => {
  beforeEach(() => {
    me.mockReset().mockResolvedValue({ authenticated: false, user: null });
    wallet.signer = {} as never;
    wallet.address = ADDRESS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves the issuer empty when nobody is signed in", async () => {
    renderPage();
    await waitFor(() => expect(me).toHaveBeenCalled());

    expect(issuerNameInput().value).toBe("");
    expect(screen.queryByText(/Prefilled from your profile/i)).not.toBeInTheDocument();
  });

  it("prefills the issuer name and type from the profile", async () => {
    me.mockResolvedValue({ authenticated: true, user: user() });
    renderPage();

    await waitFor(() => {
      expect(issuerNameInput().value).toBe("Nervos Academy");
    });
    expect(screen.getByLabelText(/Issuer type/i)).toHaveValue("SCHOOL");
    expect(
      screen.getByText(/Prefilled from your profile\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/organization type/i),
    ).toBeInTheDocument();
    // The user is told the suggestion is theirs to override.
    expect(screen.getByRole("link", { name: /Edit profile/i })).toBeInTheDocument();
  });

  it("falls back to the display name when no organization is set", async () => {
    me.mockResolvedValue({
      authenticated: true,
      user: user({ organizationName: null }),
    });
    renderPage();

    await waitFor(() => {
      expect(issuerNameInput().value).toBe("Ada Lovelace");
    });
  });

  it("never overwrites an issuer name the user typed before signing in", async () => {
    const viewer = userEvent.setup();
    // The session resolves only after the form has been filled in by hand.
    let release: (value: unknown) => void = () => {};
    me.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    renderPage();
    await waitFor(() => expect(me).toHaveBeenCalled());

    await viewer.type(issuerNameInput(), "Typing Academy");
    release({ authenticated: true, user: user() });

    // The untouched issuer type still gets the suggestion, which is what proves
    // the session has actually landed before the name is checked.
    await waitFor(() => {
      expect(screen.getByText(/organization type/i)).toBeInTheDocument();
    });
    expect(issuerNameInput().value).toBe("Typing Academy");
    expect(
      screen.queryByText(/Prefilled from your profile\./i),
    ).not.toBeInTheDocument();
  });

  it("still prefills an untouched field when the session arrives late", async () => {
    let release: (value: unknown) => void = () => {};
    me.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    renderPage();
    await waitFor(() => expect(me).toHaveBeenCalled());

    release({ authenticated: true, user: user() });

    await waitFor(() => {
      expect(issuerNameInput().value).toBe("Nervos Academy");
    });
    expect(screen.getByLabelText(/Issuer type/i)).toHaveValue("SCHOOL");
  });

  it("keeps an edited issuer type after the session arrives", async () => {
    const viewer = userEvent.setup();
    me.mockResolvedValue({ authenticated: true, user: user() });
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Issuer type/i)).toHaveValue("SCHOOL");
    });

    await viewer.selectOptions(screen.getByLabelText(/Issuer type/i), "COMPANY");
    expect(screen.getByLabelText(/Issuer type/i)).toHaveValue("COMPANY");
    // The hint disappears once the field is no longer the profile's.
    expect(screen.queryByText(/organization type/i)).not.toBeInTheDocument();
  });

  it("does not map an organization type the chain cannot express as itself", async () => {
    me.mockResolvedValue({
      authenticated: true,
      user: user({ organizationType: "nonprofit" }),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Issuer type/i)).toHaveValue("OTHER");
    });
  });
});

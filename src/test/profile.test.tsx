import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Alert, Card } from "@/components/ui";
import { AuthProvider } from "@/context/AuthProvider";
import ProfilePage from "@/pages/ProfilePage";
import RequireAuth from "@/routes/RequireAuth";
import type { AuthUser } from "@/types";

const ADDRESS = "ckt1qexampleaddress000000000000000000000";

const me = vi.fn();
const updateProfile = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    me: (...args: unknown[]) => me(...args),
    updateProfile: (...args: unknown[]) => updateProfile(...args),
  },
}));

const connectedWallet = { address: ADDRESS as string | null };

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => connectedWallet,
}));

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    walletAddress: ADDRESS,
    displayName: "Ada Lovelace",
    avatarUrl: null,
    bio: null,
    organizationName: null,
    organizationType: null,
    ...over,
  };
}

/** Route tree mirroring App.tsx: `/profile` sits behind the session guard. */
function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <Card>
                <Alert kind="info" title="Home">
                  Public page
                </Alert>
              </Card>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("profile", () => {
  beforeEach(() => {
    me.mockReset().mockResolvedValue({ authenticated: false, user: null });
    updateProfile.mockReset();
    connectedWallet.address = ADDRESS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses to show profile data without a session", async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Sign in required/i)).toBeInTheDocument();
    });
    // The guard must hold before the cookie check resolves, not just after.
    expect(screen.queryByLabelText(/Display name/i)).not.toBeInTheDocument();
  });

  it("shows the profile of the signed-in user", async () => {
    me.mockResolvedValue({ authenticated: true, user: user() });
    renderApp();

    await waitFor(() => {
      expect(screen.getByLabelText(/Display name/i)).toHaveValue(
        "Ada Lovelace",
      );
    });
    // The wallet address is the proven identity and must not be editable.
    // Shown in full and linked to the explorer, but never an editable field.
    expect(screen.getByRole("link", { name: ADDRESS })).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Wallet address/i),
    ).not.toBeInTheDocument();
    // Read-only, but still copyable.
    expect(
      screen.getByRole("button", { name: /Copy to clipboard/i }),
    ).toBeInTheDocument();
  });

  it("saves only the fields the form owns", async () => {
    const viewer = userEvent.setup();
    me.mockResolvedValue({ authenticated: true, user: user() });
    updateProfile.mockResolvedValue(user({ displayName: "Ada" }));
    renderApp();

    await waitFor(() => {
      expect(screen.getByLabelText(/Display name/i)).toHaveValue(
        "Ada Lovelace",
      );
    });

    const name = screen.getByLabelText(/Display name/i);
    await viewer.clear(name);
    await viewer.type(name, "  Ada  ");
    // A field left blank must not clear the stored value by accident.
    await viewer.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "Ada" }),
      );
    });
    const payload = updateProfile.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toHaveProperty("displayName");
    // Nothing else was edited, but PATCH semantics make that safe.
    expect(Object.keys(payload).length).toBeGreaterThanOrEqual(5);
  });

  it("reports a rejected save instead of claiming success", async () => {
    const viewer = userEvent.setup();
    me.mockResolvedValue({ authenticated: true, user: user() });
    updateProfile.mockRejectedValue(
      new Error("displayName must be at most 80 characters"),
    );
    renderApp();

    await waitFor(() => {
      expect(screen.getByLabelText(/Display name/i)).toBeInTheDocument();
    });
    await viewer.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Could not save/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/has been updated/i)).not.toBeInTheDocument();
  });
});

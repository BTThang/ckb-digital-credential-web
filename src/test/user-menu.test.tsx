import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UserMenu from "@/layouts/UserMenu";
import { AuthProvider } from "@/context/AuthProvider";
import type { AuthUser } from "@/types";

const ADDRESS = "ckt1qexampleaddress000000000000000000000";

const me = vi.fn();
const logout = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    me: (...args: unknown[]) => me(...args),
    logout: (...args: unknown[]) => logout(...args),
  },
}));

const disconnect = vi.fn();
const wallet = { address: ADDRESS as string | null, disconnect };

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => wallet,
}));

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    walletAddress: ADDRESS,
    displayName: "Alice",
    avatarUrl: null,
    bio: null,
    organizationName: null,
    organizationType: null,
    ...over,
  };
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <UserMenu />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("UserMenu", () => {
  beforeEach(() => {
    me.mockReset().mockResolvedValue({ authenticated: true, user: user() });
    logout.mockReset().mockResolvedValue({
      authenticated: false,
      user: null,
    });
    disconnect.mockReset();
    wallet.address = ADDRESS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays hidden until there is a session", async () => {
    me.mockResolvedValue({ authenticated: false, user: null });
    renderMenu();

    await waitFor(() => {
      expect(me).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: /Alice/ })).not.toBeInTheDocument();
  });

  it("offers profile, my and issued credentials plus logout", async () => {
    const viewer = userEvent.setup();
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    await viewer.click(trigger);

    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "My Credentials" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Issued Credentials" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
    // The address is shown so the account is identifiable at a glance.
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
  });

  it("falls back to a shortened address when there is no display name", async () => {
    me.mockResolvedValue({
      authenticated: true,
      user: user({ displayName: null }),
    });
    renderMenu();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /ckt1qexamp…000000/ }),
      ).toBeInTheDocument();
    });
  });

  it("marks the trigger as a disclosure with a visible caret", async () => {
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    // Without an indicator the trigger is indistinguishable from a button that
    // does nothing, so the details panel looks unreachable.
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Drawn from CSS borders, so there is no glyph that a font could be
    // missing - which is what made the arrow invisible before.
    expect(trigger.querySelector(".user-menu-caret")).toBeInTheDocument();
  });

  it("falls back to an initial when there is no avatar", async () => {
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    const avatar = trigger.querySelector(".user-menu-avatar");
    expect(avatar).toHaveTextContent("A");
    expect(avatar?.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows the avatar the profile carries", async () => {
    me.mockResolvedValue({
      authenticated: true,
      user: user({ avatarUrl: "https://example.test/a.png" }),
    });
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    const image = trigger.querySelector(".user-menu-avatar img");
    expect(image).toHaveAttribute("src", "https://example.test/a.png");
  });

  it("falls back to the initial when the avatar fails to load", async () => {
    me.mockResolvedValue({
      authenticated: true,
      user: user({ avatarUrl: "https://example.test/broken.png" }),
    });
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    const avatar = trigger.querySelector(".user-menu-avatar") as HTMLElement;
    const image = avatar.querySelector("img") as HTMLImageElement;

    // A dead avatar url must not leave a broken image in the header.
    fireEvent.error(image);
    expect(avatar).toHaveTextContent("A");
  });

  it("keeps the label as the button's accessible name", async () => {
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    // The avatar and caret are decoration, so neither is read out.
    expect(trigger).toHaveAccessibleName("Alice");
  });

  it("flips the expanded state as the panel opens and closes", async () => {
    const viewer = userEvent.setup();
    renderMenu();

    const trigger = await screen.findByRole("button", { name: /Alice/ });
    await viewer.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await viewer.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("logs out without touching the wallet connection", async () => {
    const viewer = userEvent.setup();
    renderMenu();

    await viewer.click(await screen.findByRole("button", { name: /Alice/ }));
    await viewer.click(screen.getByRole("menuitem", { name: "Logout" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
    // Logout ends the session; the signer is a separate concern.
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("disconnects without ending the session", async () => {
    const viewer = userEvent.setup();
    renderMenu();

    await viewer.click(await screen.findByRole("button", { name: /Alice/ }));
    await viewer.click(
      screen.getByRole("menuitem", { name: "Disconnect wallet" }),
    );

    expect(disconnect).toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it("groups logout and disconnect below a divider", async () => {
    const viewer = userEvent.setup();
    renderMenu();

    await viewer.click(await screen.findByRole("button", { name: /Alice/ }));

    // These two are the only actions the header offers for the session, so they
    // need to read as a group distinct from the navigation above them.
    const actions = screen
      .getAllByRole("menuitem")
      .filter((item) => item.classList.contains("user-menu-action"));

    expect(actions.map((item) => item.textContent)).toEqual([
      "Logout",
      "Disconnect wallet",
    ]);
  });

  it("omits disconnect when no wallet is connected", async () => {
    wallet.address = null;
    const viewer = userEvent.setup();
    renderMenu();

    await viewer.click(await screen.findByRole("button", { name: /Alice/ }));

    // The entry is hidden rather than disabled: there is nothing to drop.
    expect(
      screen.queryByRole("menuitem", { name: "Disconnect wallet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const viewer = userEvent.setup();
    renderMenu();

    await viewer.click(await screen.findByRole("button", { name: /Alice/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await viewer.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

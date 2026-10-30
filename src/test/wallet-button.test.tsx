import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WalletButton from "@/layouts/WalletButton";

const ADDRESS = "ckt1qexampleaddress000000000000000000000";

const connectJoyId = vi.fn();
const openConnector = vi.fn();
const signIn = vi.fn();

const wallet = {
  signer: null as unknown,
  connecting: false,
  restoring: false,
  connectJoyId,
  openConnector,
};

const auth = {
  user: null as { displayName: string } | null,
  signingIn: false,
  signIn,
};

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => wallet,
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => auth,
}));

describe("WalletButton", () => {
  beforeEach(() => {
    wallet.signer = null;
    wallet.connecting = false;
    wallet.restoring = false;
    auth.user = null;
    auth.signingIn = false;
    connectJoyId.mockReset();
    openConnector.mockReset();
    signIn.mockReset();
  });

  it("offers both connection paths when no wallet is connected", () => {
    render(<WalletButton />);

    expect(screen.getByRole("button", { name: "Connect JoyID" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Other wallets" })).toBeInTheDocument();
  });

  it("shows restoring instead of flashing connect buttons", () => {
    wallet.restoring = true;
    render(<WalletButton />);

    expect(screen.getByText(/Restoring wallet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect JoyID" })).not.toBeInTheDocument();
  });

  it("only adds sign in when a wallet is connected but the user is not", () => {
    wallet.signer = {};
    render(<WalletButton />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    // The connected address lives in the wallet menu; a second badge here
    // duplicated the same identity in the header.
    expect(screen.queryByText(/JoyID ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wallet ·/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(ADDRESS)).not.toBeInTheDocument();
  });

  it("renders nothing once the session owns the header account control", () => {
    wallet.signer = {};
    auth.user = { displayName: "Alice" };
    const { container } = render(<WalletButton />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

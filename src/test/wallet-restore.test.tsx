import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const signer = {
    getInternalAddress: vi.fn(async () => "ckb1joyid"),
    isConnected: vi.fn(async () => false),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  };

  const wallet = {
    openJoyIdSigner: vi.fn(() => signer),
    connectJoyId: vi.fn(async () => signer),
    restoreJoyId: vi.fn(async (): Promise<unknown> => undefined),
    readSignerAddress: vi.fn(async () => "ckb1joyid"),
  };

  const connector = {
    // Must be stable: the provider memoises on this identity.
    client: {},
    signer: undefined as unknown,
    open: vi.fn(),
    disconnect: vi.fn(),
  };

  const auth = {
    user: null,
    signingIn: false,
    signIn: vi.fn(async () => {}),
  };

  return { signer, wallet, connector, auth };
});

vi.mock("@/services/wallet", () => h.wallet);
vi.mock("@/context/AuthProvider", () => ({ useAuth: () => h.auth }));
vi.mock("@/services/ckb/client", () => ({
  getCkbClient: vi.fn(async () => ({})),
}));
vi.mock("@ckb-ccc/connector-react", () => ({
  useCcc: () => ({ signerInfo: undefined, ...h.connector }),
  useSigner: () => h.connector.signer,
}));

import { WalletProvider, useWallet } from "@/context/WalletProvider";

/** Renders wallet state as text so each transition can be asserted directly. */
function Probe() {
  const { signer, address, source, restoring, disconnect } = useWallet();
  return (
    <div>
      <span data-testid="source">{source ?? "none"}</span>
      <span data-testid="address">{address ?? "none"}</span>
      <span data-testid="restoring">{String(restoring)}</span>
      <span data-testid="signer">{signer ? "present" : "absent"}</span>
      <button type="button" onClick={disconnect}>
        Disconnect
      </button>
    </div>
  );
}

function renderProvider(strict = false) {
  const tree = (
    <WalletProvider>
      <Probe />
    </WalletProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe("WalletProvider reload restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.wallet.restoreJoyId.mockResolvedValue(undefined);
    h.wallet.connectJoyId.mockResolvedValue(h.signer);
    h.wallet.readSignerAddress.mockResolvedValue("ckb1joyid");
    h.connector.signer = undefined;
    h.auth.user = null;
  });

  it("re-adopts a JoyID session that survived a reload", async () => {
    h.wallet.restoreJoyId.mockResolvedValue(h.signer);
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("source")).toHaveTextContent("joyid");
    });
    expect(screen.getByTestId("signer")).toHaveTextContent("present");
    expect(screen.getByTestId("address")).toHaveTextContent("ckb1joyid");
    // Restoring is silent, so the user is never re-prompted.
    expect(h.signer.connect).not.toHaveBeenCalled();
    expect(h.wallet.connectJoyId).not.toHaveBeenCalled();
  });

  it("asks for authorisation when JoyID has no stored session", async () => {
    h.wallet.restoreJoyId.mockResolvedValue(undefined);
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("source")).toHaveTextContent("none");
  });

  it("restores at most once per mount", async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });

    expect(h.wallet.restoreJoyId).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the lookup fails", async () => {
    h.wallet.restoreJoyId.mockRejectedValue(new Error("storage unavailable"));
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("source")).toHaveTextContent("none");
  });

  it("does not revive a session the user explicitly disconnected", async () => {
    let release: ((value: unknown) => void) | undefined;
    h.wallet.restoreJoyId.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    renderProvider();
    // Disconnect lands while the storage read is still outstanding.
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    release?.(h.signer);

    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("source")).toHaveTextContent("none");
  });

  it("lets an incoming connector wallet outrank an auto-restored one", async () => {
    h.wallet.restoreJoyId.mockResolvedValue(h.signer);
    h.wallet.readSignerAddress.mockResolvedValue("ckb1injected");

    const view = renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("source")).toHaveTextContent("joyid");
    });

    // The connector element finishes its own restore after ours.
    h.connector.signer = { getInternalAddress: async () => "ckb1injected" };
    view.rerender(
      <WalletProvider>
        <Probe />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("source")).toHaveTextContent("connector");
    });
    expect(screen.getByTestId("address")).toHaveTextContent("ckb1injected");
  });
});

describe("WalletProvider under StrictMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.wallet.connectJoyId.mockResolvedValue(h.signer);
    h.wallet.readSignerAddress.mockResolvedValue("ckb1joyid");
    h.connector.signer = undefined;
    h.auth.user = null;
  });

  // StrictMode mounts, unmounts and remounts every effect in development. A
  // liveness flag that is only cleared on cleanup would latch off here and
  // strand `restoring`, spinning forever.
  it("stops restoring when no session exists", async () => {
    h.wallet.restoreJoyId.mockResolvedValue(undefined);
    renderProvider(true);

    expect(screen.getByTestId("restoring")).toHaveTextContent("true");
    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("source")).toHaveTextContent("none");
  });

  it("stops restoring when a session is found", async () => {
    h.wallet.restoreJoyId.mockResolvedValue(h.signer);
    renderProvider(true);

    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("source")).toHaveTextContent("joyid");
    expect(screen.getByTestId("address")).toHaveTextContent("ckb1joyid");
  });

  it("stops restoring when the lookup fails", async () => {
    h.wallet.restoreJoyId.mockRejectedValue(new Error("storage unavailable"));
    renderProvider(true);

    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("source")).toHaveTextContent("none");
  });

  it("does not prompt twice for the same session", async () => {
    h.wallet.restoreJoyId.mockResolvedValue(undefined);
    renderProvider(true);

    await waitFor(() => {
      expect(screen.getByTestId("restoring")).toHaveTextContent("false");
    });
    expect(h.wallet.restoreJoyId).toHaveBeenCalledTimes(1);
  });
});

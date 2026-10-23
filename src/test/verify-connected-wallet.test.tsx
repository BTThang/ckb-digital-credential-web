import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyPage from "@/pages/VerifyPage";
import type { CoreVerificationResult, SporeVerificationReport } from "@/types";

const SPORE_ID = `0x${"1".repeat(64)}`;
const TX_HASH = `0x${"b".repeat(64)}`;
const CONNECTED = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq";
const MAINNET_ADDRESS =
  "ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq";
const OTHER_WALLET = "ckt1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu";
const TYPED = "ckt1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7x7";
const CKB_POP_ID = `0x${"a".repeat(120)}`;
const DID = "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba";

const verifySporeId = vi.fn();
const lookupSpore = vi.fn();
const verify = vi.fn();
const fetchDidProfiles = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    verifySporeId: (...args: unknown[]) => verifySporeId(...args),
    lookupSpore: (...args: unknown[]) => lookupSpore(...args),
    verify: (...args: unknown[]) => verify(...args),
  },
}));

// The DID profile lookup is a chain read of its own, so it is mocked here: the
// tests must never touch the network.
vi.mock("@/services/ckb/did-profile", () => ({
  fetchDidProfiles: (...args: unknown[]) => fetchDidProfiles(...args),
}));

// The connected wallet is mocked, not the connector: the page only ever reads
// the address the provider exposes.
const wallet = {
  address: null as string | null,
  restoring: false,
};

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => wallet,
}));

function report(): SporeVerificationReport {
  return {
    state: "verified",
    indexed: null,
    verification: {
      state: "verified",
      sporeId: SPORE_ID,
      network: "testnet",
      checkedAt: "2026-01-01T00:00:00.000Z",
      sporeExists: true,
      currentOwner: CONNECTED,
      ownerLock: null,
      contentType: "application/json;version=1",
      content: null,
      rawContent: null,
      clusterId: null,
      creationTxHash: TX_HASH,
      creationTxStatus: "committed",
      blockNumber: "1234",
      capacity: "1420.1",
      reason: null,
    },
  };
}

function coreResult(
  over: Partial<CoreVerificationResult> = {},
): CoreVerificationResult {
  return {
    identifier: SPORE_ID,
    family: "spore",
    supported: true,
    routed: true,
    state: "valid",
    valid: true,
    reason: null,
    checkedAt: "2026-01-01T00:00:00.000Z",
    result: null,
    issuer: null,
    ...over,
  };
}

function renderPage() {
  const view = render(
    <MemoryRouter initialEntries={[`/verify?sporeId=${SPORE_ID}`]}>
      <VerifyPage />
    </MemoryRouter>,
  );

  return {
    ...view,
    // Swaps the connected wallet and re-renders the page, the way a real
    // connector hands over a different signer.
    switchWallet: async (address: string | null) => {
      await act(async () => {
        wallet.address = address;
        view.rerender(
          <MemoryRouter initialEntries={[`/verify?sporeId=${SPORE_ID}`]}>
            <VerifyPage />
          </MemoryRouter>,
        );
      });
    },
  };
}

function ownerInput(): HTMLInputElement {
  return screen.getByLabelText(/Expected owner address/i) as HTMLInputElement;
}

describe("VerifyPage - connected wallet as the expected owner", () => {
  beforeEach(() => {
    verifySporeId.mockReset();
    lookupSpore.mockReset();
    verify.mockReset();
    fetchDidProfiles.mockReset();
    wallet.address = null;
    wallet.restoring = false;
    verifySporeId.mockResolvedValue(report());
    lookupSpore.mockResolvedValue(null);
    verify.mockResolvedValue(coreResult());
    fetchDidProfiles.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers the connected address before it is used", async () => {
    wallet.address = CONNECTED;
    renderPage();

    expect(screen.getByRole("button", { name: /Use connected wallet/i })).toBeInTheDocument();
    // The full address stays reachable even though it is shown truncated.
    expect(screen.getByTitle(CONNECTED)).toBeInTheDocument();
    // Nothing is sent until the user asks for it.
    expect(ownerInput()).toHaveValue("");
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith(
        expect.not.objectContaining({ expectedOwner: expect.anything() }),
      );
    });
  });

  it("asks the user to connect a wallet when there is none", async () => {
    renderPage();

    expect(
      screen.getByText(/Connect a wallet to fill this from your own address/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Use connected wallet/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(verify).toHaveBeenCalled();
    });
  });

  it("fills the expected owner from the connected wallet and verifies against it", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));

    expect(ownerInput()).toHaveValue(CONNECTED);
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: SPORE_ID,
          family: "spore",
          expectedOwner: CONNECTED,
        }),
      );
    });
    expect(screen.getByText(/Filled from your connected wallet/i)).toBeInTheDocument();
  });

  it("follows the wallet when the connected wallet is switched", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    const view = renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));
    expect(ownerInput()).toHaveValue(CONNECTED);

    await view.switchWallet(OTHER_WALLET);

    await waitFor(() => {
      expect(ownerInput()).toHaveValue(OTHER_WALLET);
    });
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith(
        expect.objectContaining({ expectedOwner: OTHER_WALLET }),
      );
    });
  });

  it("clears the wallet-derived owner when the wallet disconnects", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    const view = renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));
    expect(ownerInput()).toHaveValue(CONNECTED);

    await view.switchWallet(null);

    await waitFor(() => {
      expect(ownerInput()).toHaveValue("");
    });
    await waitFor(() => {
      expect(verify).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ expectedOwner: expect.anything() }),
      );
    });
  });

  it("never overwrites an address the user typed when the wallet changes", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    const view = renderPage();

    await user.clear(ownerInput());
    await user.type(ownerInput(), TYPED);

    await view.switchWallet(OTHER_WALLET);

    await waitFor(() => {
      expect(ownerInput()).toHaveValue(TYPED);
    });
    await waitFor(() => {
      expect(verify).toHaveBeenLastCalledWith(
        expect.objectContaining({ expectedOwner: TYPED }),
      );
    });
  });

  it("hands the field back to the user when they type over a wallet-derived owner", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    const view = renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));
    expect(screen.getByText(/Filled from your connected wallet/i)).toBeInTheDocument();

    await user.clear(ownerInput());
    await user.type(ownerInput(), TYPED);
    expect(
      screen.queryByText(/Filled from your connected wallet/i),
    ).not.toBeInTheDocument();

    // A later wallet change must not take the field back.
    await view.switchWallet(OTHER_WALLET);

    await waitFor(() => {
      expect(ownerInput()).toHaveValue(TYPED);
    });
  });

  it("marks the ownership card as coming from the connected wallet", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    verify.mockResolvedValue(
      coreResult({
        ownership: {
          expectedOwner: CONNECTED,
          chainOwner: CONNECTED,
          matches: true,
          reason: null,
          checkedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));

    expect(
      await screen.findByText(/The expected owner is the address of your connected wallet/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Held by the expected owner/i)).toBeInTheDocument();
  });

  it("keeps the credential verdict separate from the owner comparison", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    verify.mockResolvedValue(
      coreResult({
        ownership: {
          expectedOwner: CONNECTED,
          chainOwner: OTHER_WALLET,
          matches: false,
          reason: "The credential is held by a different address than the expected holder.",
          checkedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));

    expect(await screen.findByText("Held by a different address")).toBeInTheDocument();
    // The credential is still valid: a different holder is not a failed
    // verification.
    expect(screen.getByText(/Verified on chain/i)).toBeInTheDocument();
    expect(
      screen.getByText(/a different holder does not make the credential invalid/i),
    ).toBeInTheDocument();
  });

  it("keeps a missing credential distinct from a failed owner comparison", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    verify.mockResolvedValue(
      coreResult({
        family: "vellum-claim",
        identifier: DID,
        state: "not_found",
        valid: false,
        reason: "No live cell was found for this identifier.",
        ownership: {
          expectedOwner: CONNECTED,
          chainOwner: null,
          matches: false,
          reason:
            "The current owner could not be determined from chain state, so ownership cannot be confirmed.",
          checkedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await user.selectOptions(
      screen.getByLabelText(/Credential family/i),
      "vellum-claim",
    );
    await user.type(screen.getByLabelText(/did:ckb identifier/i), DID);
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));

    // "Not found" is the credential verdict; the owner check is a separate,
    // unanswered question - never a mismatch.
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(
      screen.getByText(/Ownership could not be confirmed/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Held by a different address"),
    ).not.toBeInTheDocument();
  });

  it("does not verify an invalid identifier even with a connected wallet", async () => {
    wallet.address = CONNECTED;
    render(
      <MemoryRouter initialEntries={["/verify?sporeId=0xabc"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/not a Spore id/i)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(verifySporeId).not.toHaveBeenCalled();
    });
  });

  it("reports an unsupported family without turning it into an owner mismatch", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    verify.mockResolvedValue(
      coreResult({
        family: "ckb-pop",
        identifier: CKB_POP_ID,
        supported: false,
        routed: false,
        state: "unsupported",
        valid: false,
        reason: "No verifier is configured for the ckb-pop family on this network.",
        ownership: {
          expectedOwner: CONNECTED,
          chainOwner: null,
          matches: false,
          reason:
            "The current owner could not be determined from chain state, so ownership cannot be confirmed.",
          checkedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    const view = render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await user.selectOptions(
      screen.getByLabelText(/Credential family/i),
      "ckb-pop",
    );
    await user.type(screen.getByLabelText(/CKB-PoP identifier/i), CKB_POP_ID);
    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Unsupported")).toBeInTheDocument();
    expect(
      screen.getByText(/cannot verify this credential family/i),
    ).toBeInTheDocument();
    expect(view.container).toBeTruthy();
  });

  it("sends a mainnet address through the same validation path", async () => {
    const user = userEvent.setup();
    // The same address validation accepts both network prefixes, exactly as
    // the manual field does; the backend resolves it on the configured
    // network and fails closed when it does not belong there.
    wallet.address = MAINNET_ADDRESS;
    renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));

    expect(ownerInput()).toHaveValue(MAINNET_ADDRESS);
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith(
        expect.objectContaining({ expectedOwner: MAINNET_ADDRESS }),
      );
    });
  });

  it("shows the public DID profile of the connected address as information only", async () => {
    wallet.address = CONNECTED;
    fetchDidProfiles.mockResolvedValue([
      {
        did: "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba",
        name: "Vellum SDK Testnet fixture",
        bio: "A read-only profile.",
        alsoKnownAs: ["alice"],
        services: [{ id: "fixture", type: "VellumFixture" }],
      },
    ]);
    renderPage();

    expect(await screen.findByText("Public DID profile")).toBeInTheDocument();
    expect(screen.getByText("Vellum SDK Testnet fixture")).toBeInTheDocument();
    expect(screen.getByText(/did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba/)).toBeInTheDocument();
    // The profile is read from the chain for the connected address.
    expect(fetchDidProfiles).toHaveBeenCalledWith(CONNECTED);
    // It is explicitly not a proof of identity.
    expect(screen.getByText(/not proof of identity/i)).toBeInTheDocument();
  });

  it("never asks for a DID profile when no wallet is connected", async () => {
    renderPage();

    await waitFor(() => {
      expect(verify).toHaveBeenCalled();
    });
    expect(fetchDidProfiles).not.toHaveBeenCalled();
    expect(screen.queryByText(/Public DID profile/i)).not.toBeInTheDocument();
  });

  it("keeps the DID profile out of the verification request", async () => {
    const user = userEvent.setup();
    wallet.address = CONNECTED;
    fetchDidProfiles.mockResolvedValue([
      {
        did: "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba",
        name: "Vellum SDK Testnet fixture",
        bio: null,
        alsoKnownAs: [],
        services: [],
      },
    ]);
    renderPage();

    await user.click(screen.getByRole("button", { name: /Use connected wallet/i }));
    await screen.findByText(/Public DID profile/i);

    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith({
        identifier: SPORE_ID,
        family: "spore",
        expectedOwner: CONNECTED,
      });
    });
  });

  it("ignores a connected address that is not a usable CKB address", async () => {
    wallet.address = "not-an-address";
    renderPage();

    expect(
      screen.getByText(/did not report a usable CKB address/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Use connected wallet/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith(
        expect.not.objectContaining({ expectedOwner: expect.anything() }),
      );
    });
  });
});

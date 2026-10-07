import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyResultPage from "@/pages/VerifyResultPage";
import type { PublicVerification } from "@/types";

const SPORE_ID = `0x${"1".repeat(64)}`;
const TX_HASH = `0x${"b".repeat(64)}`;
const HOLDER = "ckt1qyqgoodhold0000000000000000000000000000";

const verifyCredentialId = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    verifyCredentialId: (...args: unknown[]) => verifyCredentialId(...args),
  },
}));

function publicVerification(over: Partial<PublicVerification> = {}): PublicVerification {
  return {
    valid: true,
    state: "active",
    source: "ckb",
    reason: null,
    checkedAt: "2026-02-01T00:00:00.000Z",
    credential: {
      id: SPORE_ID,
      title: "CKB Developer Certificate",
      type: "PROFESSIONAL_CERTIFICATION",
      issuer: { name: "ABC Organization", type: "COMPANY" },
      holder: HOLDER,
      issuedAt: "2026-01-15",
      expiresAt: null,
    },
    blockchain: {
      network: "testnet",
      status: "active",
      sporeId: SPORE_ID,
      currentOwner: HOLDER,
      creationTxHash: TX_HASH,
    },
    ...over,
  };
}

function renderPage(id = SPORE_ID) {
  return render(
    <MemoryRouter initialEntries={[`/verify/${id}`]}>
      <Routes>
        <Route path="/verify/:credentialId" element={<VerifyResultPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VerifyResultPage", () => {
  beforeEach(() => {
    verifyCredentialId.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows CREDENTIAL VERIFIED with holder, issuer and network", async () => {
    verifyCredentialId.mockResolvedValue(publicVerification());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("CREDENTIAL VERIFIED")).toBeInTheDocument();
    });

    expect(verifyCredentialId).toHaveBeenCalledWith(SPORE_ID);
    expect(screen.getByText("CKB Developer Certificate")).toBeInTheDocument();
    expect(screen.getByText(/ABC Organization/)).toBeInTheDocument();
    expect(screen.getAllByText(HOLDER).length).toBeGreaterThan(0);
    expect(screen.getByText(/CKB Testnet \(testnet\)/)).toBeInTheDocument();
    expect(screen.getByText(/Verified directly from CKB/)).toBeInTheDocument();
    expect(screen.getByText(/active/)).toBeInTheDocument();
  });

  it("keeps the same id verifiable after a transfer (new holder from the chain)", async () => {
    // The credential id never changes on transfer; only the holder does.
    const transferred = publicVerification();
    transferred.credential!.holder = "ckt1qyqnewholder0000000000000000000000000000";
    transferred.blockchain.currentOwner = transferred.credential!.holder;
    verifyCredentialId.mockResolvedValue(transferred);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("CREDENTIAL VERIFIED")).toBeInTheDocument();
    });
    expect(
      screen.getAllByText("ckt1qyqnewholder0000000000000000000000000000").length,
    ).toBeGreaterThan(0);
  });

  it("reports a melted credential as NOT FOUND, not as invalid", async () => {
    verifyCredentialId.mockResolvedValue(
      publicVerification({
        valid: false,
        state: "not_found",
        reason: "No live Spore cell has this id",
        credential: null,
        blockchain: {
          network: "testnet",
          status: "not_found",
          sporeId: SPORE_ID,
          currentOwner: null,
          creationTxHash: null,
        },
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("CREDENTIAL NOT FOUND")).toBeInTheDocument();
    });
    expect(screen.getByText(/melted and no longer exists/i)).toBeInTheDocument();
    expect(screen.queryByText("CREDENTIAL INVALID")).not.toBeInTheDocument();
    expect(screen.queryByText("CREDENTIAL VERIFIED")).not.toBeInTheDocument();
  });

  it("marks an expired credential invalid while still showing it exists", async () => {
    const expired = publicVerification();
    expired.valid = false;
    expired.state = "invalid";
    expired.reason = "Expired on 2026-01-31";
    expired.credential!.expiresAt = "2026-01-31";
    verifyCredentialId.mockResolvedValue(expired);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("CREDENTIAL INVALID")).toBeInTheDocument();
    });
    expect(screen.getByText(/Expired on/)).toBeInTheDocument();
    expect(screen.getByText("CKB Developer Certificate")).toBeInTheDocument();
    expect(screen.queryByText("CREDENTIAL NOT FOUND")).not.toBeInTheDocument();
  });

  it("shows an infrastructure failure as UNAVAILABLE, never as a credential verdict", async () => {
    verifyCredentialId.mockResolvedValue(
      publicVerification({
        valid: false,
        state: "unable_to_verify",
        reason: "The CKB network could not be queried",
        credential: null,
        blockchain: {
          network: "testnet",
          status: "unknown",
          sporeId: SPORE_ID,
          currentOwner: null,
          creationTxHash: null,
        },
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("VERIFICATION UNAVAILABLE")).toBeInTheDocument();
    });
    expect(screen.getByText(/says nothing about the credential/i)).toBeInTheDocument();
    expect(screen.queryByText("CREDENTIAL NOT FOUND")).not.toBeInTheDocument();
    expect(screen.queryByText("CREDENTIAL INVALID")).not.toBeInTheDocument();
  });

  it("surfaces an API error without claiming anything about the credential", async () => {
    verifyCredentialId.mockRejectedValue(new Error("The CKB RPC node is currently unavailable"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("VERIFICATION UNAVAILABLE")).toBeInTheDocument();
    });
    expect(screen.queryByText(/No live Spore cell/i)).not.toBeInTheDocument();
  });

  it("rejects a malformed id in the URL without calling the API", () => {
    renderPage("0xabc");

    expect(screen.getByText(/not a credential id/i)).toBeInTheDocument();
    expect(verifyCredentialId).not.toHaveBeenCalled();
  });
});
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyPage from "@/pages/VerifyPage";
import type { SporeVerificationReport } from "@/types";

const SPORE_ID = `0x${"1".repeat(64)}`;
const TX_HASH = `0x${"b".repeat(64)}`;

const verifySporeId = vi.fn();
const lookupSpore = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    verifySporeId: (...args: unknown[]) => verifySporeId(...args),
    lookupSpore: (...args: unknown[]) => lookupSpore(...args),
  },
}));

function report(
  state: SporeVerificationReport["state"],
  over: Partial<SporeVerificationReport["verification"]> = {},
): SporeVerificationReport {
  const found = state === "verified";

  return {
    state,
    // A bare Spore id has no index entry behind it by definition.
    indexed: null,
    verification: {
      state,
      sporeId: SPORE_ID,
      network: "testnet",
      checkedAt: "2026-01-01T00:00:00.000Z",
      sporeExists: found,
      currentOwner: found ? "ckt1qowner" : null,
      ownerLock: null,
      contentType: "application/json;version=1",
      content: null,
      rawContent: null,
      clusterId: null,
      // The creation tx comes from the cell's outpoint, never from the id.
      creationTxHash: found ? TX_HASH : SPORE_ID,
      creationTxStatus: found ? "committed" : null,
      blockNumber: found ? "1234" : null,
      capacity: found ? "1420.1" : null,
      reason: state === "verified" ? null : "Spore cell not found on chain",
      ...over,
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/verify?sporeId=${SPORE_ID}`]}>
      <VerifyPage />
    </MemoryRouter>,
  );
}

describe("VerifyPage", () => {
  beforeEach(() => {
    verifySporeId.mockReset();
    lookupSpore.mockReset();
    lookupSpore.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a malformed id without calling the API", () => {
    render(
      <MemoryRouter initialEntries={["/verify?sporeId=0xabc"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/not a Spore id/i)).toBeInTheDocument();
    expect(verifySporeId).not.toHaveBeenCalled();
  });

  it("reports a verified credential as verified", async () => {
    verifySporeId.mockResolvedValue(report("verified"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Verified on chain/i)).toBeInTheDocument();
    });
    expect(verifySporeId).toHaveBeenCalledWith(SPORE_ID);
    expect(screen.getByText("ckt1qowner")).toBeInTheDocument();
  });

  it("distinguishes not found from a node outage", async () => {
    verifySporeId.mockResolvedValue(report("not_found"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No live Spore cell has this id/i)).toBeInTheDocument();
    });
    // The two states must never be conflated.
    expect(screen.queryByText(/could not be queried/i)).not.toBeInTheDocument();
  });

  it("reports an RPC failure as unable to verify, not as missing", async () => {
    verifySporeId.mockResolvedValue(report("unable_to_verify"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/could not be queried/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/not the same as/i)).toBeInTheDocument();
    expect(screen.queryByText(/No live Spore cell has this id/i)).not.toBeInTheDocument();
  });

  it("surfaces an API error instead of claiming a credential is invalid", async () => {
    verifySporeId.mockRejectedValue(
      new Error("The CKB RPC node is currently unavailable"),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Verification failed/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/No live Spore cell has this id/i),
    ).not.toBeInTheDocument();
  });

  it("shows a stale indexed row only as context", async () => {
    // The index still claims the credential is active, but the chain says the
    // cell is gone. The verdict must follow the chain.
    verifySporeId.mockResolvedValue(report("not_found"));
    lookupSpore.mockResolvedValue({
      id: "cred_1",
      sporeId: SPORE_ID,
      title: "Stale credential",
      description: "",
      issuerName: "Academy",
      issuerType: "SCHOOL",
      issuerAddress: "ckt1qissuer",
      recipientAddress: "ckt1qowner",
      ownerAddress: "ckt1qowner",
      credentialType: "COURSE_COMPLETION",
      issueDate: "2026-01-01",
      expirationDate: null,
      creationTxHash: TX_HASH,
      status: "active",
      network: "testnet",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Indexed credential/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No live Spore cell has this id/i)).toBeInTheDocument();
    expect(screen.getByText("Stale credential")).toBeInTheDocument();
  });

  it("submits a pasted id on demand", async () => {
    const user = userEvent.setup();
    verifySporeId.mockResolvedValue(report("verified"));
    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/Spore id/i), SPORE_ID);
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(verifySporeId).toHaveBeenCalledWith(SPORE_ID);
    });
  });
});

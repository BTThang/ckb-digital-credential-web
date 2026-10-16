import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyPage from "@/pages/VerifyPage";
import type { CoreVerificationResult, SporeVerificationReport } from "@/types";

const SPORE_ID = `0x${"1".repeat(64)}`;
const TX_HASH = `0x${"b".repeat(64)}`;
const DID = "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba";
const CKB_POP_ID = `0x${"a".repeat(120)}`;
const OWNER = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq";

const verifySporeId = vi.fn();
const lookupSpore = vi.fn();
const verify = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    verifySporeId: (...args: unknown[]) => verifySporeId(...args),
    lookupSpore: (...args: unknown[]) => lookupSpore(...args),
    verify: (...args: unknown[]) => verify(...args),
  },
}));

function coreResult(
  over: Partial<CoreVerificationResult> = {},
): CoreVerificationResult {
  return {
    identifier: DID,
    family: "vellum-claim",
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
    verify.mockReset();
    lookupSpore.mockResolvedValue(null);
    verify.mockResolvedValue(coreResult());
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

  it("routes a did:ckb identifier to the vellum-claim family", async () => {
    const user = userEvent.setup();
    verify.mockResolvedValue(coreResult());
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

    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith({
        identifier: DID,
        family: "vellum-claim",
      });
    });
    expect(verifySporeId).not.toHaveBeenCalled();
    expect(await screen.findByText(/Verified on chain/i)).toBeInTheDocument();
  });

  it("rejects a malformed did:ckb identifier without asking the backend", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await user.selectOptions(
      screen.getByLabelText(/Credential family/i),
      "vellum-claim",
    );
    await user.type(screen.getByLabelText(/did:ckb identifier/i), "did:ckb:nope");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(screen.getByText(/not a did:ckb identifier/i)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it("sends the expected owner and renders the ownership check", async () => {
    const user = userEvent.setup();
    verifySporeId.mockResolvedValue(report("verified"));
    verify.mockResolvedValue(
      coreResult({
        family: "spore",
        identifier: SPORE_ID,
        ownership: {
          expectedOwner: OWNER,
          chainOwner: OWNER,
          matches: true,
          reason: null,
          checkedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    renderPage();
    await user.type(screen.getByLabelText(/Expected owner address/i), OWNER);

    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: SPORE_ID,
          family: "spore",
          expectedOwner: OWNER,
        }),
      );
    });
    expect(await screen.findByText(/Held by the expected owner/i)).toBeInTheDocument();
  });

  it("reports a mismatched owner from the chain, not the request", async () => {
    const user = userEvent.setup();
    verifySporeId.mockResolvedValue(report("verified"));
    verify.mockResolvedValue(
      coreResult({
        family: "spore",
        identifier: SPORE_ID,
        ownership: {
          expectedOwner: OWNER,
          chainOwner: "ckt1qsomeoneelse",
          matches: false,
          reason: "The credential is held by a different address.",
          checkedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    renderPage();
    await user.type(screen.getByLabelText(/Expected owner address/i), OWNER);

    expect(
      await screen.findByText("Held by a different address"),
    ).toBeInTheDocument();
    expect(screen.getByText("ckt1qsomeoneelse")).toBeInTheDocument();
  });

  it("shows issuer evidence and never claims an unsigned issuer is proven", async () => {
    verifySporeId.mockResolvedValue(report("verified"));
    verify.mockResolvedValue(
      coreResult({
        family: "spore",
        identifier: SPORE_ID,
        issuer: {
          family: "spore",
          address: null,
          proofStatus: "legacy",
          verified: false,
          name: "CKB Academy",
          type: "SCHOOL",
        },
      }),
    );

    renderPage();

    expect(await screen.findByText(/Issuer evidence/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Issuer is claimed, not proven/i),
    ).toBeInTheDocument();
  });

  it("rejects a malformed expected owner before calling the backend", async () => {
    const user = userEvent.setup();
    verifySporeId.mockResolvedValue(report("verified"));

    renderPage();
    await user.type(screen.getByLabelText(/Expected owner address/i), "not-an-address");

    expect(await screen.findByText(/not a CKB address/i)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalledWith(
      expect.objectContaining({ expectedOwner: expect.anything() }),
    );
  });

  it("shows unsupported for a family this build cannot verify", async () => {
    const user = userEvent.setup();
    verify.mockResolvedValue(
      coreResult({
        family: "ckb-pop",
        identifier: CKB_POP_ID,
        supported: false,
        routed: false,
        state: "unsupported",
        valid: false,
        reason: "No verifier is configured for the ckb-pop family on this network.",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <VerifyPage />
      </MemoryRouter>,
    );

    await user.selectOptions(
      screen.getByLabelText(/Credential family/i),
      "ckb-pop",
    );
    await user.type(screen.getByLabelText(/CKB-PoP identifier/i), CKB_POP_ID);
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Unsupported")).toBeInTheDocument();
    expect(
      screen.getByText(/cannot verify this credential family/i),
    ).toBeInTheDocument();
    // An unsupported family is never confused with a missing credential.
    expect(screen.queryByText(/No live credential/i)).not.toBeInTheDocument();
  });
});

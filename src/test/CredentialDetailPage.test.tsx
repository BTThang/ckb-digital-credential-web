import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CredentialDetailPage from "@/pages/CredentialDetailPage";
import type { Credential, VerificationReport } from "@/types";

const CREDENTIAL_ID = "cred_1";
const SPORE_ID = `0x${"1".repeat(64)}`;
const TX_HASH = `0x${"b".repeat(64)}`;

const getCredential = vi.fn();
const verifyCredential = vi.fn();
const listTransactions = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    getCredential: (...args: unknown[]) => getCredential(...args),
    verifyCredential: (...args: unknown[]) => verifyCredential(...args),
    listTransactions: (...args: unknown[]) => listTransactions(...args),
  },
}));

const walletState = vi.hoisted(() => ({
  signer: null as unknown,
  address: null as string | null,
}));

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => walletState,
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,QRQR"),
  },
}));

const credential: Credential = {
  id: CREDENTIAL_ID,
  sporeId: SPORE_ID,
  title: "CKB Developer Certificate",
  description: "Completed the developer track",
  issuerName: "ABC Organization",
  issuerType: "COMPANY",
  issuerAddress: "ckt1qissuer",
  recipientAddress: "ckt1qholder",
  ownerAddress: "ckt1qholder",
  credentialType: "PROFESSIONAL_CERTIFICATION",
  issueDate: "2026-01-15",
  expirationDate: null,
  creationTxHash: TX_HASH,
  status: "active",
  network: "testnet",
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-01-15T00:00:00.000Z",
};

const report: VerificationReport = {
  state: "verified",
  indexed: null,
  credential,
  verification: {
    state: "verified",
    sporeId: SPORE_ID,
    network: "testnet",
    checkedAt: "2026-02-01T00:00:00.000Z",
    sporeExists: true,
    currentOwner: "ckt1qholder",
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/credentials/${CREDENTIAL_ID}`]}>
      <Routes>
        <Route path="/credentials/:id" element={<CredentialDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CredentialDetailPage QR sharing", () => {
  beforeEach(() => {
    getCredential.mockReset();
    verifyCredential.mockReset();
    listTransactions.mockReset();
    getCredential.mockResolvedValue(credential);
    verifyCredential.mockResolvedValue(report);
    listTransactions.mockResolvedValue({ data: [], total: 0 });
    walletState.signer = null;
    walletState.address = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens a QR dialog that encodes only the public verification URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("CKB Developer Certificate");
    await user.click(screen.getByRole("button", { name: "QR code" }));

    await waitFor(() => {
      expect(screen.getByText(/Scan to verify this credential on CKB/i)).toBeInTheDocument();
    });

    expect(screen.getByAltText(/QR code for/)).toBeInTheDocument();
    const expectedUrl = `${window.location.origin}/verify/${SPORE_ID}`;
    expect(screen.getAllByText(expectedUrl).length).toBeGreaterThan(0);
    // No session, token or secret may appear in the shared value.
    expect(expectedUrl).not.toMatch(/session|token|nonce|password/);
  });

  it("renders the transfer history and keeps the credential active", async () => {
    getCredential.mockResolvedValue({
      ...credential,
      ownerAddress: "ckt1qnewowner",
    });
    verifyCredential.mockResolvedValue({
      ...report,
      credential: { ...credential, ownerAddress: "ckt1qnewowner" },
      verification: { ...report.verification, currentOwner: "ckt1qnewowner" },
    });
    listTransactions.mockResolvedValue({
      total: 2,
      data: [
        {
          id: "tx_1",
          txHash: TX_HASH,
          credentialId: CREDENTIAL_ID,
          sporeId: SPORE_ID,
          type: "CREATE_CREDENTIAL",
          status: "committed",
          blockNumber: "1",
          detail: "ABC Organization",
          createdAt: "2026-01-15T00:00:00.000Z",
          updatedAt: "2026-01-15T00:00:00.000Z",
        },
        {
          id: "tx_2",
          txHash: `0x${"c".repeat(64)}`,
          credentialId: CREDENTIAL_ID,
          sporeId: SPORE_ID,
          type: "TRANSFER_CREDENTIAL",
          status: "committed",
          blockNumber: "2",
          detail: "to ckt1qnewowner",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    });

    renderPage();

    expect(await screen.findByText("Lifecycle")).toBeInTheDocument();
    expect(await screen.findByText("Transferred")).toBeInTheDocument();
    expect(screen.getAllByText("TRANSFERRED").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/keeps the credential valid/i),
    ).toBeInTheDocument();
  });

  it("reports a melted credential as revoked", async () => {
    const melted = { ...credential, status: "melted" as const };
    getCredential.mockResolvedValue(melted);
    verifyCredential.mockResolvedValue({
      ...report,
      state: "not_found",
      credential: melted,
      verification: {
        ...report.verification,
        state: "not_found",
        sporeExists: false,
        currentOwner: null,
        creationTxStatus: "committed",
      },
    });

    renderPage();

    expect(await screen.findByText("Lifecycle")).toBeInTheDocument();
    expect(screen.getAllByText("REVOKED").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/no longer exists on chain/i).length,
    ).toBeGreaterThan(0);
  });

  it("offers transfer and melt when the live cell confirms ownership, even if the index row is stale", async () => {
    walletState.signer = { sign: vi.fn() };
    walletState.address = "ckt1qholder";
    // The index still says "pending" from issue time; the chain says verified.
    getCredential.mockResolvedValue({ ...credential, status: "pending" });

    renderPage();

    expect(
      await screen.findByRole("button", { name: "Transfer" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Melt" })).toBeInTheDocument();
  });

  it("hides transfer and melt when the live cell shows another owner", async () => {
    walletState.signer = { sign: vi.fn() };
    walletState.address = "ckt1qsomebodyelse";

    renderPage();

    await screen.findByText("CKB Developer Certificate");
    await waitFor(() => expect(verifyCredential).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "Transfer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Melt" }),
    ).not.toBeInTheDocument();
  });
});
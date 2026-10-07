import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import CredentialCard from "@/components/CredentialCard";
import type { Credential } from "@/types";

const SPORE_ID = `0x${"1".repeat(64)}`;

vi.mock("@/context/WalletProvider", () => ({
  useWallet: () => ({ signer: null, address: null }),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,QRQR"),
  },
}));

const credential: Credential = {
  id: "cred_1",
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
  creationTxHash: `0x${"b".repeat(64)}`,
  status: "active",
  network: "testnet",
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-01-15T00:00:00.000Z",
};

function renderCard() {
  return render(
    <MemoryRouter>
      <CredentialCard credential={credential} />
    </MemoryRouter>,
  );
}

describe("CredentialCard actions", () => {
  afterEach(() => {
    // Keep the module mock's `mockResolvedValue`; only clear call history.
    vi.clearAllMocks();
  });

  it("offers a public Verify link addressed by Spore id", () => {
    renderCard();

    const verify = screen.getByRole("link", { name: "Verify" });
    expect(verify).toHaveAttribute("href", `/verify/${SPORE_ID}`);
  });

  it("opens a QR share dialog from the Share action", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(screen.getByText(/Scan to verify this credential on CKB/i)).toBeInTheDocument();
    });

    expect(screen.getByAltText(/QR code for/)).toBeInTheDocument();
    expect(
      screen.getAllByText(`${window.location.origin}/verify/${SPORE_ID}`).length,
    ).toBeGreaterThan(0);
  });
});
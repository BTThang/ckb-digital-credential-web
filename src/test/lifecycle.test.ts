import { describe, expect, it } from "vitest";

import type { Credential } from "@/types";
import { lifecycleState } from "@/utils/lifecycle";

function credential(overrides: Partial<Credential> = {}): Credential {
  return {
    id: "cred_1",
    sporeId: `0x${"1".repeat(64)}`,
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
    ...overrides,
  };
}

describe("lifecycleState", () => {
  it("is ACTIVE while the recipient still holds the cell", () => {
    expect(lifecycleState(credential())).toBe("ACTIVE");
  });

  it("is TRANSFERRED once the owner differs from the recipient", () => {
    expect(
      lifecycleState(credential({ ownerAddress: "ckt1qnewowner" })),
    ).toBe("TRANSFERRED");
  });

  it("is REVOKED for a melted credential", () => {
    expect(lifecycleState(credential({ status: "melted" }))).toBe("REVOKED");
  });

  it("is NOT_FOUND when the index cannot see the cell", () => {
    expect(lifecycleState(credential({ status: "unknown" }))).toBe("NOT_FOUND");
  });
});
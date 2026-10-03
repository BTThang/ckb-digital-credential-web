import { describe, expect, it } from "vitest";

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  validateIssueForm,
  type IssueFormValues,
} from "@/services/credentials/validation";
import { buildPayload } from "@/services/spore/payload";

const valid: IssueFormValues = {
  title: "Advanced TypeScript",
  description: "Completed the advanced course",
  issuerName: "CKB Academy",
  issuerType: "SCHOOL",
  credentialType: "COURSE_COMPLETION",
  issueDate: "2026-01-15",
  expirationDate: "",
  recipientAddress: "ckt1qxy2kgdygjrsqgeqfgu7tpmx5e43j8k6q7pvxu",
};

function form(over: Partial<IssueFormValues> = {}): IssueFormValues {
  return { ...valid, ...over };
}

describe("issue form validation", () => {
  it("accepts a complete form", () => {
    expect(validateIssueForm(valid)).toBeNull();
  });

  it("accepts an empty expiration date as never expiring", () => {
    expect(validateIssueForm(form({ expirationDate: "" }))).toBeNull();
  });

  it("requires a title", () => {
    expect(validateIssueForm(form({ title: "   " }))).toMatch(/title is required/i);
  });

  it("requires an issuer name", () => {
    expect(validateIssueForm(form({ issuerName: "" }))).toMatch(
      /issuer name is required/i,
    );
  });

  it("requires a recipient address", () => {
    expect(validateIssueForm(form({ recipientAddress: "" }))).toMatch(
      /recipient/i,
    );
  });

  it("rejects an expiration date before the issue date", () => {
    expect(
      validateIssueForm(
        form({ issueDate: "2026-01-15", expirationDate: "2026-01-01" }),
      ),
    ).toMatch(/cannot be before the issue date/i);
  });

  it("rejects malformed dates", () => {
    expect(validateIssueForm(form({ issueDate: "15/01/2026" }))).toMatch(
      /valid issue date/i,
    );
  });

  it("enforces length limits", () => {
    expect(validateIssueForm(form({ title: "x".repeat(MAX_TITLE_LENGTH + 1) }))).toMatch(
      /at most/i,
    );
    expect(
      validateIssueForm(
        form({ description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1) }),
      ),
    ).toMatch(/at most/i);
  });

  it("accepts input at exactly the limit the cell can store", () => {
    // The form must not be stricter than the on-chain cell, or a credential the
    // chain could hold would be impossible to issue.
    expect(
      validateIssueForm(form({ title: "x".repeat(MAX_TITLE_LENGTH) })),
    ).toBeNull();
    expect(
      validateIssueForm(
        form({ description: "x".repeat(MAX_DESCRIPTION_LENGTH) }),
      ),
    ).toBeNull();
  });

  it("does not accept a description the payload builder would truncate", () => {
    // Guards the link between this limit and `buildPayload`: if the two ever
    // drift, a user could issue a credential whose description silently
    // differs from what they typed.
    const atLimit = "x".repeat(MAX_DESCRIPTION_LENGTH);
    const payload = buildPayload({
      title: "t",
      description: atLimit,
      issuerName: "i",
      issuerType: "OTHER",
      credentialType: "OTHER",
      issueDate: "2026-01-01",
      expirationDate: null,
    });

    expect(payload.description).toBe(atLimit);
  });
});

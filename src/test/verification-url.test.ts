import { describe, expect, it } from "vitest";

import { verificationUrl } from "@/utils/verification-url";

const SPORE_ID = `0x${"1".repeat(64)}`;

describe("verificationUrl", () => {
  it("builds an absolute /verify/:id link from the live origin", () => {
    expect(verificationUrl(SPORE_ID)).toBe(
      `${window.location.origin}/verify/${SPORE_ID}`,
    );
  });

  it("encodes the identifier so the link is always a valid URL", () => {
    expect(verificationUrl("did:ckb:abc")).toBe(
      `${window.location.origin}/verify/${encodeURIComponent("did:ckb:abc")}`,
    );
  });

  it("carries only the identifier - no token, session or secret", () => {
    const url = verificationUrl(SPORE_ID);

    expect(url).not.toMatch(/token|session|secret|key=|auth=/i);
    // The id is the only query/path data beyond the fixed /verify prefix.
    expect(url.slice(url.indexOf("/verify/"))).toBe(`/verify/${SPORE_ID}`);
  });
});

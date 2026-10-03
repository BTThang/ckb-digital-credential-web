import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SPORE_CONTENT_TYPE,
  buildPayload,
  packPayload,
  parsePayload,
} from "@/services/spore/payload";

describe("on-chain payload", () => {
  it("trims text and stamps the network and version", () => {
    const payload = buildPayload({
      title: "  Course  ",
      description: "  details ",
      issuerName: " Academy ",
      issuerType: "SCHOOL",
      credentialType: "COURSE_COMPLETION",
      issueDate: "2026-01-01",
      expirationDate: null,
    });

    expect(payload).toEqual({
      version: 1,
      title: "Course",
      description: "details",
      issuerName: "Academy",
      issuerType: "SCHOOL",
      credentialType: "COURSE_COMPLETION",
      issueDate: "2026-01-01",
      expirationDate: null,
      network: "testnet",
    });
  });

  it("omits the owner so the lock script stays the single source of truth", () => {
    const payload = buildPayload({
      title: "t",
      description: "",
      issuerName: "i",
      issuerType: "OTHER",
      credentialType: "OTHER",
      issueDate: "2026-01-01",
      expirationDate: null,
    });

    expect(payload).not.toHaveProperty("owner");
    expect(payload).not.toHaveProperty("ownerAddress");
  });
});

describe("payload decoding", () => {
  it("round-trips a payload through bytes", () => {
    const original = buildPayload({
      title: "Round trip",
      description: "decodes cleanly",
      issuerName: "Nervos Academy",
      issuerType: "SCHOOL",
      credentialType: "SKILL_ACHIEVEMENT",
      issueDate: "2026-02-02",
      expirationDate: "2027-02-02",
    });

    const bytes = new TextEncoder().encode(JSON.stringify(original));
    const hex = `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

    expect(parsePayload(SPORE_CONTENT_TYPE, hex)).toEqual(original);
  });

  it("returns null for a non-JSON content type", () => {
    expect(parsePayload("image/png", "0x00")).toBeNull();
  });

  it("returns null instead of throwing on malformed content", () => {
    expect(parsePayload("application/json;version=1", "0xdeadbeef")).toBeNull();
  });

  it("returns null for valid JSON that is not a credential", () => {
    // The cell content is third-party data. A Spore carrying some other JSON
    // document must decode to `null`, never to a half-populated credential.
    const json = (value: unknown) =>
      `0x${[
        ...new TextEncoder().encode(JSON.stringify(value)),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`;

    expect(parsePayload(SPORE_CONTENT_TYPE, json({ hello: "world" }))).toBeNull();
    expect(parsePayload(SPORE_CONTENT_TYPE, json(null))).toBeNull();
    expect(parsePayload(SPORE_CONTENT_TYPE, json([1, 2, 3]))).toBeNull();
  });

  it("fills absent optional fields with safe defaults", () => {
    // A cell written by an older build must stay readable, so a missing field
    // is defaulted rather than causing the whole credential to be dropped.
    const minimal = `0x${[
      ...new TextEncoder().encode(JSON.stringify({ title: "Bare minimum" })),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;

    expect(parsePayload(SPORE_CONTENT_TYPE, minimal)).toEqual({
      version: 1,
      title: "Bare minimum",
      description: "",
      issuerName: "",
      issuerType: "OTHER",
      credentialType: "OTHER",
      issueDate: "",
      expirationDate: null,
      network: "testnet",
    });
  });
});

describe("payload encoding", () => {
  const sample = () =>
    buildPayload({
      title: "Hex not text",
      description: "{ this is JSON, not hex }",
      issuerName: "Nervos Academy",
      issuerType: "SCHOOL",
      credentialType: "COURSE_COMPLETION",
      issueDate: "2026-02-02",
      expirationDate: null,
    });

  it("writes bytes, because SporeData.content is a molecule byteVec", () => {
    // A raw JSON string makes `ccc` parse it as hex and fail on the leading
    // `{` with "Invalid Hex character encountered at position 0".
    const content = packPayload(sample());

    expect(content.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(content)).toBe(JSON.stringify(sample()));
  });

  it("round-trips through the decoder", () => {
    const original = sample();

    expect(parsePayload(SPORE_CONTENT_TYPE, packPayload(original))).toEqual(
      original,
    );
  });
});

describe("spore id guard", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("refuses to build a transfer for a malformed id before touching the chain", async () => {
    const { transferSporeCredential, meltSporeCredential } = await import(
      "@/services/spore"
    );
    const signer = {} as never;

    await expect(
      transferSporeCredential(signer, "0xnothex", "ckb1"),
    ).rejects.toThrow(/not a valid Spore id/);
    await expect(meltSporeCredential(signer, "0xnothex")).rejects.toThrow(
      /not a valid Spore id/,
    );
  });
});

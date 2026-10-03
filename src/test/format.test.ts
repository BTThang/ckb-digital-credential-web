import { describe, expect, it } from "vitest";

import {
  humanizeToken,
  isExpired,
  shortAddress,
  shortId,
} from "@/utils/format";

const SPORE_ID = `0x${"1".repeat(64)}`;

describe("truncation helpers", () => {
  it("leaves short values untouched", () => {
    expect(shortId("0x1234")).toBe("0x1234");
  });

  it("keeps both ends of a long value", () => {
    const truncated = shortId(SPORE_ID);
    expect(truncated).toContain("…");
    expect(truncated.endsWith(SPORE_ID.slice(-6))).toBe(true);
  });

  it("truncates bech32 addresses", () => {
    const address = "ckb1qxy2kgdygjrsqgeqfgu7tpmx5e43j8k6tqvsxt";
    expect(shortAddress(address)).toContain("…");
    expect(shortAddress(address).endsWith(address.slice(-6))).toBe(true);
  });
});

describe("expiration", () => {
  it("treats an empty date as never expiring", () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
    expect(isExpired("")).toBe(false);
  });

  it("compares against today", () => {
    expect(isExpired("2000-01-01")).toBe(true);
    expect(isExpired("2999-12-31")).toBe(false);
  });
});

describe("humanizeToken", () => {
  it("turns an enum token into readable text", () => {
    expect(humanizeToken("COURSE_COMPLETION")).toBe("course completion");
    expect(humanizeToken("SCHOOL")).toBe("school");
  });
});

import { describe, expect, it } from "vitest";

import {
  isCkbAddress,
  isSporeId,
  isTxHash,
  normalizeSporeId,
} from "@/utils/validation";

const TX_HASH = `0x${"a".repeat(64)}`;
const SPORE_ID = `0x${"1".repeat(64)}`;

describe("spore id validation", () => {
  it("accepts a bare 32-byte value", () => {
    // A Spore v2 id is the cell's type script args, so it is exactly this shape.
    expect(isSporeId(SPORE_ID)).toBe(true);
  });

  it("rejects a cell outpoint", () => {
    // The outpoint is the shape this id is most often mistaken for, and it was
    // previously accepted - which meant every real id produced by createSpore
    // failed validation, and every outpoint was passed to the node as a real id.
    expect(isSporeId(`${TX_HASH}0x0`)).toBe(false);
    expect(isSporeId(`${TX_HASH}0x1a`)).toBe(false);
  });

  it("cannot tell a spore id from a tx hash by shape alone", () => {
    // Both are 32 bytes of hex. This is exactly why the backend must confirm
    // against the chain instead of trusting the caller's claim.
    expect(isSporeId(TX_HASH)).toBe(true);
  });

  it("rejects a truncated or non-hex id", () => {
    expect(isSporeId(`0x${"1".repeat(63)}`)).toBe(false);
    expect(isSporeId(`0x${"z".repeat(64)}`)).toBe(false);
    expect(isSporeId("")).toBe(false);
  });

  it("tolerates surrounding whitespace and normalises case", () => {
    expect(isSporeId(`  ${SPORE_ID}  `)).toBe(true);
    expect(normalizeSporeId(`  ${SPORE_ID.toUpperCase().replace("0X", "0x")} `)).toBe(
      SPORE_ID,
    );
  });
});

describe("transaction hash validation", () => {
  it("accepts 32 bytes with or without 0x", () => {
    expect(isTxHash(TX_HASH)).toBe(true);
    expect(isTxHash(TX_HASH.slice(2))).toBe(true);
  });

  it("rejects other lengths", () => {
    expect(isTxHash("0xabc")).toBe(false);
  });
});

describe("address validation", () => {
  it("accepts mainnet and testnet prefixes", () => {
    // This is a prefilter only: `ccc.Address.fromString` does the real
    // bech32m checksum and prefix validation before any write.
    expect(isCkbAddress("ckb1qxy2kgdygjrsqgeqfgu7tpmx5e43j8k6tqvsxt")).toBe(true);
    expect(isCkbAddress("ckt1qxy2kgdygjrsqgeqfgu7tpmx5e43j8k6q7pvxu")).toBe(true);
  });

  it("rejects other prefixes and shapes", () => {
    expect(isCkbAddress("btc1qxy2kgdygjrsqgeqfgu7tpmx5e43j8k6tqvsxt")).toBe(false);
    expect(isCkbAddress("0xabc")).toBe(false);
    expect(isCkbAddress("ckb1")).toBe(false);
  });
});

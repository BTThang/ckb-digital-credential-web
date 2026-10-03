/**
 * A Spore v2 id is a bare 32-byte value: the cell's *type script args*, which
 * `@ckb-ccc/spore` fills with `hashTypeId(firstInput, outputIndex)` and returns
 * from `createSpore`. It is NOT the cell outpoint, so the familiar
 * `0x<txHash>0x<index>` shape must be rejected rather than accepted.
 *
 * `SPORE_ID_PATTERN` is shared verbatim with the backend's `SPORE_ID` so the
 * two can never disagree about which ids are real.
 */
export const SPORE_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/** A transaction hash, with or without the `0x` prefix people often paste. */
export const TX_HASH_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;

/**
 * A cheap bech32 prefilter, not a checksum validator. The real check is
 * `ccc.Address.fromString`, which every write path runs before touching the
 * chain.
 */
export const ADDRESS_PATTERN = /^(ckb|ckt)1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,}$/;

export function isSporeId(value: string): boolean {
  return SPORE_ID_PATTERN.test(value.trim());
}

/** Normalises a pasted id; people paste them in any case, with stray spaces. */
export function normalizeSporeId(value: string): string {
  return value.trim().toLowerCase();
}

export function isTxHash(value: string): boolean {
  return TX_HASH_PATTERN.test(value.trim());
}

export function isCkbAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value.trim());
}

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

export const CKB_POP_IDENTIFIER_PATTERN = /^0x[0-9a-fA-F]{120}$/;

/**
 * A Vellum `did:ckb` identifier: the literal prefix plus a 32-character
 * lowercase base32 payload (RFC 4648 alphabet `a-z2-7`, which decodes to the
 * 20-byte Type ID args the cell's type script carries). This mirrors
 * `ccc.didCkb.isDidCkb`; the backend's reader owns the authoritative decode.
 */
export const DID_CKB_PATTERN = /^did:ckb:[a-z2-7]{32}$/;

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

export function isCkbPopId(value: string): boolean {
  return CKB_POP_IDENTIFIER_PATTERN.test(value.trim());
}

export function normalizeCkbPopId(value: string): string {
  return value.trim().toLowerCase();
}

export function isDidCkb(value: string): boolean {
  return DID_CKB_PATTERN.test(value.trim());
}

/** Trims a pasted identifier; the bech32 payload itself is case-sensitive. */
export function normalizeDidCkb(value: string): string {
  return value.trim();
}

export function isTxHash(value: string): boolean {
  return TX_HASH_PATTERN.test(value.trim());
}

export function isCkbAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value.trim());
}

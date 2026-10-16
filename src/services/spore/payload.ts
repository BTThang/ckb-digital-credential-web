import { ccc } from "@ckb-ccc/ccc";

import { NETWORK } from "@/config";
import type { CredentialProof, CredentialType, IssuerType } from "@/types";

/**
 * Shape version of the JSON stored in the Spore's `content` field.
 *
 * Bump only for a breaking change. A new optional field can ride along in
 * `version: 1`, because `parsePayload` fills absent keys with defaults rather
 * than rejecting the cell.
 */
export const CREDENTIAL_PAYLOAD_VERSION = 1;

export const SPORE_CONTENT_TYPE = "application/json;version=1";

/** CKB cells are capacity-bounded, so the payload is deliberately small. */
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 1_000;
export const MAX_ISSUER_NAME_LENGTH = 120;

export interface CredentialPayload {
  version: 1;
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  credentialType: CredentialType;
  /** `YYYY-MM-DD`. */
  issueDate: string;
  /** `null` means the credential never expires. */
  expirationDate: string | null;
  network: string;
  /**
   * Phase 1: the issuer's address and its signature over the credential
   * envelope. Both are optional so pre-existing cells stay readable and are
   * reported as `legacy` rather than rejected.
   */
  issuerAddress?: string;
  proof?: CredentialProof;
}

export interface CredentialPayloadInput {
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  credentialType: CredentialType;
  issueDate: string;
  /** Empty string or `null` means the credential never expires. */
  expirationDate: string | null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Builds the exact bytes that go into the Spore cell.
 *
 * This is the one place the on-chain schema is written, so a field added here is
 * immediately visible in the verifier's decoder - the read path is
 * `parsePayload`, and the two are deliberately kept adjacent.
 */
export function buildPayload(input: CredentialPayloadInput): CredentialPayload {
  return {
    version: CREDENTIAL_PAYLOAD_VERSION,
    title: truncate(input.title.trim(), MAX_TITLE_LENGTH),
    description: truncate(input.description.trim(), MAX_DESCRIPTION_LENGTH),
    issuerName: truncate(input.issuerName.trim(), MAX_ISSUER_NAME_LENGTH),
    issuerType: input.issuerType,
    credentialType: input.credentialType,
    issueDate: input.issueDate.trim(),
    expirationDate: input.expirationDate?.trim() || null,
    network: NETWORK,
  };
}

/** `true` when the cell is one of ours, by content type. */
export function isCredentialSpore(contentType: string): boolean {
  return contentType === SPORE_CONTENT_TYPE;
}

/**
 * Serialises a payload into the bytes stored in the Spore cell.
 *
 * `SporeData.content` is a molecule `byteVec`, so it needs bytes and not text:
 * `ccc` reads a plain string as hex and rejects the leading `{` of the JSON
 * document with "Invalid Hex character encountered at position 0". Encoding here
 * keeps the write path next to its reader, {@link parsePayload}.
 */
export function packPayload(payload: CredentialPayload): ccc.Bytes {
  return ccc.bytesFrom(JSON.stringify(payload), "utf8");
}

/**
 * Decodes a Spore's content, tolerating anything unexpected.
 *
 * Cell content is written by a third party, so it is untrusted input. A cell
 * that is not a credential Spore, or whose JSON does not match the schema,
 * yields `null` instead of throwing: one malformed cell must not be able to
 * take down a whole listing.
 */
export function parsePayload(
  contentType: string,
  content: ccc.BytesLike,
): CredentialPayload | null {
  if (!isCredentialSpore(contentType)) return null;

  let raw: string;
  try {
    raw = new TextDecoder().decode(ccc.bytesFrom(content));
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as Partial<CredentialPayload>;

  // `title` is the only field with no sensible default, so its absence is the
  // signal that this is not a credential payload at all.
  if (typeof candidate.title !== "string" || candidate.title.length === 0) {
    return null;
  }

  const payload: CredentialPayload = {
    version: CREDENTIAL_PAYLOAD_VERSION,
    title: candidate.title,
    description: typeof candidate.description === "string" ? candidate.description : "",
    issuerName: typeof candidate.issuerName === "string" ? candidate.issuerName : "",
    issuerType: candidate.issuerType ?? "OTHER",
    credentialType: candidate.credentialType ?? "OTHER",
    issueDate: typeof candidate.issueDate === "string" ? candidate.issueDate : "",
    expirationDate:
      typeof candidate.expirationDate === "string" ? candidate.expirationDate : null,
    network: typeof candidate.network === "string" ? candidate.network : "testnet",
  };

  // Phase 1 fields are copied only when actually present, so a legacy cell
  // (no proof) round-trips with exactly its original keys.
  if (typeof candidate.issuerAddress === "string") {
    payload.issuerAddress = candidate.issuerAddress;
  }
  const proof = parseProof(candidate.proof);
  if (proof) payload.proof = proof;

  return payload;
}

/** Validate and copy a `proof` field. Returns null if invalid/absent. */
function parseProof(value: unknown): CredentialProof | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string" || v.type.length === 0) return null;
  if (typeof v.algorithm !== "string" || v.algorithm.length === 0) return null;
  if (typeof v.created !== "string" || Number.isNaN(Date.parse(v.created))) return null;
  if (typeof v.identity !== "string" || v.identity.length < 2) return null;
  if (typeof v.signature !== "string" || v.signature.length < 2) return null;
  if (v.signType !== "CkbSecp256k1" && v.signType !== "JoyId") return null;
  return {
    type: v.type,
    algorithm: v.algorithm,
    created: v.created,
    identity: v.identity,
    signature: v.signature,
    signType: v.signType,
  };
}

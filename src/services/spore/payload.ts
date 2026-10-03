import { ccc } from "@ckb-ccc/ccc";

import { NETWORK } from "@/config";
import type { CredentialType, IssuerType } from "@/types";

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

  return {
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
}

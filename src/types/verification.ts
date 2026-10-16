import type { Credential, CredentialPayload, CredentialStatus } from "./credential";

export const VERIFICATION_STATES = [
  "verified",
  "not_found",
  "unable_to_verify",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/**
 * What a live chain read found. `state` is the verdict; the rest is evidence
 * for the person reading the page.
 */
export interface SporeVerification {
  state: VerificationState;
  sporeId: string;
  network: string;
  checkedAt: string;
  sporeExists: boolean;
  currentOwner: string | null;
  ownerLock: string | null;
  contentType: string | null;
  content: CredentialPayload | null;
  rawContent: string | null;
  clusterId: string | null;
  /**
   * Transaction that created the Spore, or `null`/the id itself when no live
   * cell could be read. A Spore id is a hash over (input, index), so it does
   * not encode the creation tx - it comes from the cell's outpoint.
   */
  creationTxHash: string;
  creationTxStatus: string | null;
  blockNumber: string | null;
  capacity: string | null;
  reason: string | null;
}

/**
 * The cached row as it was *before* the chain was read.
 *
 * Reporting the cache separately is what lets the UI show how far the local
 * index had drifted without letting it influence the verdict.
 */
export interface IndexedContext {
  foundInDatabase: true;
  statusInDatabase: CredentialStatus;
  ownerInDatabase: string;
  ownerMatchesChain: boolean | null;
  metadataMatchesChain: boolean | null;
  mismatchedFields: string[];
  reconciled: boolean;
}

export interface VerificationReport {
  state: VerificationState;
  verification: SporeVerification;
  indexed: IndexedContext | null;
  credential: Credential | null;
}

/**
 * `GET /api/spores/:sporeId/verify` - no index entry exists for this shape, so
 * `indexed` is always `null` and the chain state carries the verdict.
 */
export interface SporeVerificationReport {
  state: VerificationState;
  verification: SporeVerification;
  indexed: null;
}

/**
 * `GET /api/verify/:credentialId` - the public verdict for third parties and
 * for the shareable `/verify/:credentialId` page. Decided entirely by the
 * Verification Service on the backend; the page only renders it.
 */
export const PUBLIC_VERIFICATION_STATES = [
  "active",
  "invalid",
  "not_found",
  "unable_to_verify",
] as const;
export type PublicVerificationState = (typeof PUBLIC_VERIFICATION_STATES)[number];

/** Credential facts from the live cell payload. `null` when no cell is live. */
export interface PublicVerificationCredential {
  id: string;
  title: string | null;
  type: string | null;
  issuer: { name: string; type: string | null } | null;
  holder: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
}

export interface PublicVerificationBlockchain {
  network: string;
  status: "active" | "not_found" | "unknown";
  sporeId: string;
  currentOwner: string | null;
  creationTxHash: string | null;
}

export interface PublicVerification {
  valid: boolean;
  state: PublicVerificationState;
  source: "ckb";
  reason: string | null;
  checkedAt: string;
  credential: PublicVerificationCredential | null;
  blockchain: PublicVerificationBlockchain;
  cryptographic: CryptographicVerification;
  combined: CombinedVerification;
}

export const CRYPTOGRAPHIC_STATUSES = [
  "verified",
  "invalid",
  "legacy",
  "unsupported",
  "unavailable",
] as const;
export type CryptographicStatus = (typeof CRYPTOGRAPHIC_STATUSES)[number];

export interface CryptographicChecks {
  signature: boolean;
  issuer: boolean;
}

export interface CryptographicVerification {
  valid: boolean;
  status: CryptographicStatus;
  reason: string | null;
  checks: CryptographicChecks | null;
  proof: {
    hasProof: boolean;
    type: string | null;
    algorithm: string | null;
    created: string | null;
    signType: string | null;
    issuerAddress: string | null;
  } | null;
}

export interface CombinedVerification {
  valid: boolean;
  status: "verified" | "invalid";
  reason: string | null;
}

/** Phase 2/3 - core family-agnostic verification types. */
export const CORE_VERIFICATION_STATES = [
  "valid",
  "invalid",
  "not_found",
  "unable_to_verify",
  "unsupported",
] as const;
export type CoreVerificationState = (typeof CORE_VERIFICATION_STATES)[number];

export const CREDENTIAL_FAMILIES = [
  "spore",
  "vellum-claim",
  "ckb-pop",
] as const;
export type CredentialFamily = (typeof CREDENTIAL_FAMILIES)[number];

export interface FamilyVerification {
  family: CredentialFamily;
  state: CoreVerificationState;
  valid: boolean;
  reason: string | null;
  checkedAt: string;
  evidence: unknown;
}

/** Phase 5 - issuer evidence derived from the family's own evidence. */
export interface IssuerEvidence {
  family: CredentialFamily;
  /** The issuer address the credential claims; null when none is carried. */
  address: string | null;
  /** The issuer-proof verdict. Only `verified` proves the address binding. */
  proofStatus: CryptographicStatus;
  /** True only when the proof verified *and* binds the key to `address`. */
  verified: boolean;
  /** Self-asserted payload metadata - display only, never proof. */
  name: string | null;
  type: string | null;
}

/**
 * Phase 5 - the answer to "does this credential belong to the expected holder?".
 * Present only when the verifier supplied `expectedOwner`. `matches` is
 * fail-closed: it is true only when both addresses resolved to the same lock
 * script on this network.
 */
export interface OwnershipVerification {
  expectedOwner: string;
  chainOwner: string | null;
  matches: boolean;
  reason: string | null;
  checkedAt: string;
}

export interface CoreVerificationResult {
  identifier: string;
  family: CredentialFamily | null;
  supported: boolean;
  routed: boolean;
  state: CoreVerificationState;
  valid: boolean;
  reason: string | null;
  checkedAt: string;
  result: FamilyVerification | null;
  /** Always present; null when the family has no issuer concept. */
  issuer: IssuerEvidence | null;
  /** Present only when the caller supplied an expected owner. */
  ownership?: OwnershipVerification;
}

export interface FamilyDescriptor {
  family: CredentialFamily;
  description: string;
}

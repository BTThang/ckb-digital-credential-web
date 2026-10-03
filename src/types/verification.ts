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

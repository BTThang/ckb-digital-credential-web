export const CREDENTIAL_TYPES = [
  "COURSE_COMPLETION",
  "SKILL_ACHIEVEMENT",
  "EVENT_PARTICIPATION",
  "PROFESSIONAL_CERTIFICATION",
  "OTHER",
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const ISSUER_TYPES = [
  "COMPANY",
  "SCHOOL",
  "EVENT_ORGANIZER",
  "PROFESSIONAL_ORGANIZATION",
  "OTHER",
] as const;
export type IssuerType = (typeof ISSUER_TYPES)[number];

export const CREDENTIAL_STATUSES = [
  "pending",
  "active",
  "melted",
  "unknown",
] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

/**
 * The JSON document stored in the Spore cell.
 *
 * The owner is deliberately absent: the live cell's lock script is the
 * authoritative owner, and a second copy here would be a weaker source of
 * truth that could silently disagree after a transfer.
 */
export interface CredentialPayload {
  version: number;
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  credentialType: CredentialType;
  issueDate: string;
  expirationDate: string | null;
  network: string;
}

/** An indexed credential. The API's cache of the chain, never the truth. */
export interface Credential {
  id: string;
  sporeId: string;
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  issuerAddress: string;
  recipientAddress: string;
  ownerAddress: string;
  credentialType: CredentialType;
  issueDate: string;
  expirationDate: string | null;
  creationTxHash: string;
  status: CredentialStatus;
  network: string;
  createdAt: string;
  updatedAt: string;
}

/** What the browser sends to the indexer once a Spore has been broadcast. */
export interface CreateCredentialPayload {
  sporeId: string;
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  issuerAddress: string;
  recipientAddress: string;
  credentialType: CredentialType;
  issueDate: string;
  expirationDate: string | null;
  creationTxHash: string;
  network: string;
}

/** A credential read straight from the chain, bypassing the index. */
export interface OwnedSpore {
  sporeId: string;
  owner: string;
  data: CredentialPayload | null;
}

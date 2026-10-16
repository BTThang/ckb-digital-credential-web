import type { ccc } from "@ckb-ccc/ccc";

import type { CredentialPayload, CredentialProof } from "@/types";

import { canonicalize } from "./canonical.js";

export { canonicalize, NonCanonicalValueError } from "./canonical.js";

export const PROOF_TYPE = "CKB-CredentialSignature";
export const PROOF_ALGORITHM = "secp256k1";
export const PROOF_MESSAGE_DOMAIN = "CKB-Credential-Envelope/1";

/**
 * The Credential Envelope (signed projection).
 */
export interface CredentialEnvelope {
  version: 1;
  credential: {
    title: string;
    description: string;
    issuerName: string;
    issuerType: CredentialPayload["issuerType"];
    credentialType: CredentialPayload["credentialType"];
    issueDate: string;
    expirationDate: string | null;
    network: string;
  };
  issuer: {
    name: string;
    address: string;
  };
  proof: {
    type: string;
    algorithm: string;
    created: string;
  };
}

/**
 * Build envelope from credential payload fields (base) and issuer.
 *
 * The base payload must be the one that will be written on-chain (including
 * truncation etc). The envelope must match exactly what the verifier
 * reconstructs.
 */
export function buildEnvelope(
  base: Pick<
    CredentialPayload,
    | "title"
    | "description"
    | "issuerName"
    | "issuerType"
    | "credentialType"
    | "issueDate"
    | "expirationDate"
    | "network"
  >,
  issuerAddress: string,
  meta: { type: string; algorithm: string; created: string },
): CredentialEnvelope {
  return {
    version: 1,
    credential: {
      title: base.title,
      description: base.description,
      issuerName: base.issuerName,
      issuerType: base.issuerType,
      credentialType: base.credentialType,
      issueDate: base.issueDate,
      expirationDate: base.expirationDate,
      network: base.network,
    },
    issuer: { name: base.issuerName, address: issuerAddress },
    proof: { type: meta.type, algorithm: meta.algorithm, created: meta.created },
  };
}

/** Signed message string. */
export function credentialProofMessage(envelope: CredentialEnvelope): string {
  return `${PROOF_MESSAGE_DOMAIN}\n${canonicalize(envelope)}`;
}

/**
 * Create a cryptographic issuer proof.
 *
 * This is performed in the browser, with the connected wallet's signer.
 * No backend key is ever touched. The returned proof (identity, signature,
 * signType) is what is stored inside the on-chain payload.
 */
export type CreateCredentialProofInput = Pick<
  CredentialPayload,
  | "title"
  | "description"
  | "issuerName"
  | "issuerType"
  | "credentialType"
  | "issueDate"
  | "expirationDate"
  | "network"
>;

export async function createCredentialProof(
  input: CreateCredentialProofInput,
  signer: ccc.Signer,
  issuerAddress: string,
): Promise<CredentialProof> {
  const created = new Date().toISOString();
  const meta = { type: PROOF_TYPE, algorithm: PROOF_ALGORITHM, created };

  const envelope = buildEnvelope(input, issuerAddress, meta);
  const message = credentialProofMessage(envelope);

  const signed = await signer.signMessage(message);
  const signType = signed.signType;

  // Only accept schemes we can verify. Keep the allow-list tight for Phase 1.
  const supported = signType === "CkbSecp256k1" || signType === "JoyId";
  if (!supported) {
    throw new Error(
      `The connected wallet's signature scheme (${signType}) is not supported for credential proofs. Please use a CKB wallet that produces CkbSecp256k1 or JoyId signatures.`,
    );
  }

  return {
    type: PROOF_TYPE,
    algorithm: PROOF_ALGORITHM,
    created,
    identity: signed.identity,
    signature: signed.signature,
    signType: signType as "CkbSecp256k1" | "JoyId",
  };
}

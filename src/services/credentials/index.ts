import type { ccc } from "@ckb-ccc/ccc";

import { api } from "@/services/api";
import {
  createSporeCredential,
  meltSporeCredential,
  transferSporeCredential,
} from "@/services/spore";
import { buildPayload } from "@/services/spore/payload";
import { addToHistory } from "@/services/transactions/local-history";
import type { CredentialType, IssuerType } from "@/types";

import { validateIssueForm } from "./validation";

export * from "./validation";

export interface IssueCredentialInput {
  signer: ccc.Signer;
  /** The connected wallet, recorded as the issuer's address in the index. */
  issuerAddress: string;
  title: string;
  description: string;
  issuerName: string;
  issuerType: IssuerType;
  credentialType: CredentialType;
  issueDate: string;
  /** Empty string means "never expires". */
  expirationDate: string;
  recipientAddress: string;
}

export interface IssueCredentialResult {
  txHash: string;
  sporeId: string;
  /** Null when the index write failed; the credential is still real on chain. */
  credentialId: string | null;
  indexError: string | null;
}

export interface TransferCredentialInput {
  signer: ccc.Signer;
  sporeId: string;
  to: string;
  credentialId: string;
  title: string;
}

export interface MeltCredentialInput {
  signer: ccc.Signer;
  sporeId: string;
  credentialId: string;
  title: string;
}

/**
 * Tells the indexer about a wallet write and asks it to re-read the chain.
 *
 * Both calls are best-effort by design: the transaction is already broadcast
 * and the chain is already authoritative, so a failing indexer must never turn
 * a successful write into an error in the UI.
 */
async function reportToIndexer(input: {
  txHash: string;
  type: "CREATE_CREDENTIAL" | "TRANSFER_CREDENTIAL" | "MELT_CREDENTIAL";
  credentialId: string | null;
  sporeId: string;
  detail: string | null;
}): Promise<void> {
  try {
    await api.trackTransaction({
      txHash: input.txHash,
      credentialId: input.credentialId,
      sporeId: input.sporeId,
      type: input.type,
      status: "submitted",
      detail: input.detail,
    });
  } catch {
    /* the local history already covers this */
  }

  try {
    await api.syncCredentials();
  } catch {
    /* the next sync will pick it up */
  }
}

/**
 * Issues a credential: validate, sign, broadcast, then index.
 *
 * The on-chain write happens first and is never rolled back for an indexing
 * problem, so `indexError` is reported separately rather than thrown.
 */
export async function issueCredential(
  input: IssueCredentialInput,
): Promise<IssueCredentialResult> {
  const invalid = validateIssueForm(input);
  if (invalid) throw new Error(invalid);

  const payload = buildPayload({
    title: input.title,
    description: input.description,
    issuerName: input.issuerName,
    issuerType: input.issuerType,
    credentialType: input.credentialType,
    issueDate: input.issueDate,
    expirationDate: input.expirationDate || null,
  });

  const { txHash, sporeId } = await createSporeCredential(
    input.signer,
    payload,
    input.recipientAddress,
  );

  addToHistory({
    txHash,
    type: "CREATE_CREDENTIAL",
    credentialId: null,
    sporeId,
    title: payload.title,
    status: "submitted",
    detail: payload.issuerName,
  });

  let credentialId: string | null = null;
  let indexError: string | null = null;

  try {
    const created = await api.createCredential({
      sporeId,
      title: payload.title,
      description: payload.description,
      issuerName: payload.issuerName,
      issuerType: payload.issuerType,
      issuerAddress: input.issuerAddress,
      recipientAddress: input.recipientAddress,
      credentialType: payload.credentialType,
      issueDate: payload.issueDate,
      expirationDate: payload.expirationDate,
      creationTxHash: txHash,
      network: payload.network,
    });
    credentialId = created.id;
  } catch (cause) {
    indexError =
      cause instanceof Error
        ? cause.message
        : "The indexer could not index this credential yet.";
  }

  void reportToIndexer({
    txHash,
    type: "CREATE_CREDENTIAL",
    credentialId,
    sporeId,
    detail: payload.issuerName,
  });

  return { txHash, sporeId, credentialId, indexError };
}

/** Moves a credential's Spore cell to `to`. Only the current owner can sign. */
export async function transferCredential(
  input: TransferCredentialInput,
): Promise<string> {
  const txHash = await transferSporeCredential(
    input.signer,
    input.sporeId,
    input.to,
  );

  addToHistory({
    txHash,
    type: "TRANSFER_CREDENTIAL",
    credentialId: input.credentialId,
    sporeId: input.sporeId,
    title: input.title,
    status: "submitted",
    detail: `to ${input.to}`,
  });

  void reportToIndexer({
    txHash,
    type: "TRANSFER_CREDENTIAL",
    credentialId: input.credentialId,
    sporeId: input.sporeId,
    detail: `to ${input.to}`,
  });

  return txHash;
}

/**
 * Destroys the credential's Spore cell.
 *
 * Irreversible: afterwards the Spore id verifies as `not_found`, which is what
 * a revocation looks like on CKB.
 */
export async function meltCredential(
  input: MeltCredentialInput,
): Promise<string> {
  const txHash = await meltSporeCredential(input.signer, input.sporeId);

  addToHistory({
    txHash,
    type: "MELT_CREDENTIAL",
    credentialId: input.credentialId,
    sporeId: input.sporeId,
    title: input.title,
    status: "submitted",
    detail: null,
  });

  void reportToIndexer({
    txHash,
    type: "MELT_CREDENTIAL",
    credentialId: input.credentialId,
    sporeId: input.sporeId,
    detail: null,
  });

  return txHash;
}

import { ccc } from "@ckb-ccc/ccc";
import * as spore from "@ckb-ccc/spore";

import { getCkbClient } from "@/services/ckb/client";
import { isSporeId, normalizeSporeId } from "@/utils/validation";

import {
  SPORE_CONTENT_TYPE,
  packPayload,
  parsePayload,
  type CredentialPayload,
} from "./payload";

export interface SporeWriteResult {
  txHash: string;
  sporeId: string;
}

export interface ChainSporeSummary {
  sporeId: string;
  owner: string;
  payload: CredentialPayload | null;
}

function assertSporeId(sporeId: string): string {
  const value = sporeId.trim();
  if (!isSporeId(value)) {
    throw new Error(`"${sporeId}" is not a valid Spore id`);
  }
  return value;
}

/**
 * Issues a credential as a Spore cell owned by `to`.
 *
 * The order matters: `createSpore` builds the output but does not fund it, so
 * inputs and fee must be completed before the wallet is asked to sign.
 */
export async function createSporeCredential(
  signer: ccc.Signer,
  payload: CredentialPayload,
  to: string,
): Promise<SporeWriteResult> {
  const client = getCkbClient();
  const { script: toScript } = await ccc.Address.fromString(to, client);

  const { tx, id } = await spore.createSpore({
    signer,
    data: {
      contentType: SPORE_CONTENT_TYPE,
      content: packPayload(payload),
    },
    to: toScript,
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);

  const txHash = await signer.sendTransaction(tx);
  return { txHash, sporeId: id };
}

/** Moves an existing Spore cell to a new owner. The payload never changes. */
export async function transferSporeCredential(
  signer: ccc.Signer,
  sporeId: string,
  to: string,
): Promise<string> {
  const id = assertSporeId(sporeId);
  const client = getCkbClient();
  const { script: toScript } = await ccc.Address.fromString(to, client);

  const { tx } = await spore.transferSpore({ signer, id, to: toScript });
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);

  return signer.sendTransaction(tx);
}

/** Destroys the Spore cell. On chain the credential stops existing. */
export async function meltSporeCredential(
  signer: ccc.Signer,
  sporeId: string,
): Promise<string> {
  const id = assertSporeId(sporeId);

  const { tx } = await spore.meltSpore({ signer, id });
  // A melt burns the cell: the output already carries the input's capacity, so
  // pulling in more inputs would only burn extra CKB on the fee.
  await tx.completeFeeBy(signer);

  return signer.sendTransaction(tx);
}

/** Reads a live Spore. `undefined` means it does not exist (never made or melted). */
/**
 * Reads a live Spore. `undefined` means it does not exist (never made or melted).
 *
 * The returned cell's `outPoint` is the only place the creation transaction
 * hash exists: the Spore id is a hash over (input, index) and does not encode
 * it, so it cannot be recovered from the id.
 */
export async function readSpore(sporeId: string) {
  const client = getCkbClient();
  return spore.findSpore(client, normalizeSporeId(sporeId));
}

/**
 * Lists live Spores owned by an address.
 *
 * The indexer can return historical Spores the current decoder cannot read, so
 * iteration is guarded and simply stops at the first failure instead of
 * failing the whole request.
 */
export async function listSporesByOwner(
  address: string,
  limit = 50,
): Promise<ChainSporeSummary[]> {
  const client = getCkbClient();
  const { script: lock } = await ccc.Address.fromString(address, client);
  const results: ChainSporeSummary[] = [];

  try {
    for await (const found of spore.findSpores({
      client,
      lock,
      limit,
      order: "desc",
    })) {
      results.push({
        // The Spore id *is* the type script args.
        sporeId: ccc.hexFrom(found.spore.cellOutput.type?.args ?? "0x"),
        owner: ccc.Address.fromScript(found.spore.cellOutput.lock, client).toString(),
        payload: parsePayload(found.sporeData.contentType, found.sporeData.content),
      });
      if (results.length >= limit) break;
    }
  } catch {
    // Return what was decoded so far; an undecodable historical Spore is not a
    // reason to hide the credentials that are readable.
  }

  return results;
}

import { ccc } from "@ckb-ccc/ccc";
import { JoyId } from "@ckb-ccc/joy-id";

import { WALLET_ICON, WALLET_NAME } from "@/config";

/**
 * Only a CKB signer can carry a Spore, so the connector modal filters out
 * BTC/EVM/Nostr signers. The signature matches CCC's `signerFilter`.
 */
export async function isCkbSigner(signerInfo: ccc.SignerInfo): Promise<boolean> {
  return signerInfo.signer.type === ccc.SignerType.CKB;
}

/**
 * Builds a JoyID CKB signer without asking JoyID for anything.
 *
 * Split out of `connectJoyId` so a reload can interrogate the signer for an
 * existing session without opening the JoyID popup.
 *
 * `getJoyIdSigners` lists CKB first, and CKB is the only chain that can hold a
 * Spore, so the first entry is the one to use.
 */
export function openJoyIdSigner(client: ccc.Client): ccc.Signer {
  const entry = JoyId.getJoyIdSigners(client, WALLET_NAME, WALLET_ICON)[0];
  if (!entry) throw new Error("JoyID CKB signer is unavailable");

  return entry.signer;
}

/** Opens a JoyID CKB signer and connects it. */
export async function connectJoyId(client: ccc.Client): Promise<ccc.Signer> {
  const signer = openJoyIdSigner(client);
  await signer.connect();
  return signer;
}

/**
 * Recovers the JoyID session that survived a page reload.
 *
 * JoyID's signer keeps the granted session in local storage, so `isConnected()`
 * is a storage read rather than a prompt. Returns `undefined` when the user has
 * to authorise again, or when JoyID cannot be used in this browser at all --
 * `getJoyIdSigners` swaps in signers that always throw for standalone browsers
 * and webviews, and the UI cannot tell those apart from "not connected".
 */
export async function restoreJoyId(
  client: ccc.Client,
): Promise<ccc.Signer | undefined> {
  try {
    const signer = openJoyIdSigner(client);
    return (await signer.isConnected()) ? signer : undefined;
  } catch {
    return undefined;
  }
}

/** Reads the signer's address, returning an empty string if it is unavailable. */
export async function readSignerAddress(signer: ccc.Signer): Promise<string> {
  try {
    return await signer.getInternalAddress();
  } catch {
    return "";
  }
}

import { ccc } from "@ckb-ccc/ccc";

import { CKB_RPC_URL, NETWORK } from "@/config";

/**
 * One shared read-only client for the whole tab.
 *
 * `ClientPublic*.open()` is synchronous and hands back an ownership claim, so
 * this is a plain memo rather than a promise. The claim is deliberately kept
 * for the lifetime of the page: the client is used for every read (tips,
 * transactions, Spores) and is never used to create a signer.
 *
 * A failed open is not cached, so a later call can retry once the RPC recovers.
 */
let cached: ccc.Client | null = null;

export function getCkbClient(): ccc.Client {
  if (cached) return cached;

  const config = CKB_RPC_URL
    ? ({ urls: [CKB_RPC_URL] as unknown as readonly [string, ...string[]] } as never)
    : undefined;

  const owner =
    NETWORK === "mainnet"
      ? ccc.ClientPublicMainnet.open(config)
      : ccc.ClientPublicTestnet.open(config);

  cached = owner.value;
  return cached;
}

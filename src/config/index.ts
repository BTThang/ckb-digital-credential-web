export type CkbNetwork = "testnet" | "mainnet";

const rawNetwork = import.meta.env.VITE_CKB_NETWORK;

/** Testnet unless the environment explicitly asks for mainnet. */
export const NETWORK: CkbNetwork =
  rawNetwork === "mainnet" ? "mainnet" : "testnet";

/**
 * `localhost` rather than `127.0.0.1` on purpose: the session cookie is
 * `SameSite=Strict`, and the browser treats the two as different sites, so
 * mixing them makes the cookie vanish without any error to explain it.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const EXPLORER_URL = (
  import.meta.env.VITE_CKB_EXPLORER_URL ??
  (NETWORK === "mainnet"
    ? "https://explorer.nervos.org/mainnet"
    : "https://explorer.nervos.org/testnet")
).replace(/\/+$/, "");

export const WALLET_NAME =
  import.meta.env.VITE_WALLET_NAME ?? "CKB Digital Credential";

export const WALLET_ICON =
  import.meta.env.VITE_WALLET_ICON ?? "https://nervos.org/favicon.ico";

/** Empty means "use the CCC public endpoints for this network". */
export const CKB_RPC_URL = import.meta.env.VITE_CKB_RPC_URL?.trim() ?? "";

/** Preferred networks passed to wallet providers when asking for a signer. */
export const PREFERRED_NETWORKS: CkbNetwork[] = [NETWORK];

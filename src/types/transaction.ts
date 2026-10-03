export const TRANSACTION_STATUSES = [
  "submitted",
  "pending",
  "committed",
  "failed",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_TYPES = [
  "CREATE_CREDENTIAL",
  "TRANSFER_CREDENTIAL",
  "MELT_CREDENTIAL",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Raw node status, kept distinct from the four application states above. */
export const CKB_TRANSACTION_STATUSES = [
  "sent",
  "pending",
  "proposed",
  "committed",
  "unknown",
  "rejected",
] as const;
export type CkbTransactionStatus = (typeof CKB_TRANSACTION_STATUSES)[number];

/** An indexed transaction-tracking row. */
export interface TransactionRecord {
  id: string;
  txHash: string;
  credentialId: string | null;
  sporeId: string | null;
  type: TransactionType;
  status: TransactionStatus;
  blockNumber: string | null;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Chain-authoritative view of a transaction. */
export interface TransactionChainInfo {
  txHash: string;
  found: boolean;
  status: CkbTransactionStatus | null;
  blockNumber: string | null;
  blockHash: string | null;
  reason: string | null;
  error: string | null;
  inputCount: number | null;
  outputCount: number | null;
}

/** `GET /api/transactions/:txHash` - chain state merged with the index row. */
export interface TransactionStatusReport {
  txHash: string;
  status: TransactionStatus;
  found: boolean;
  chain: TransactionChainInfo;
  indexed: Omit<TransactionRecord, "txHash"> | null;
  inSync: boolean | null;
}

/** Query accepted by `GET /api/credentials`. */
export interface ListCredentialsQuery {
  owner?: string;
  recipient?: string;
  issuer?: string;
  issuerName?: string;
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** `GET /api/health` - liveness of the API plus a CKB probe. */
export interface HealthReport {
  status: "ok" | "degraded";
  chain: {
    network: string;
    addressPrefix: "ckb" | "ckt";
    rpcUrl: string;
    reachable: boolean;
    tipBlockNumber: string | null;
  };
}

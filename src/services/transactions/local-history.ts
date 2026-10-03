import type { TransactionRecord, TransactionType } from "@/types";

const KEY = "ckb-credential.tx-history.v1";
const MAX_ENTRIES = 100;

export interface LocalTransaction {
  txHash: string;
  type: TransactionType;
  credentialId: string | null;
  sporeId: string | null;
  title: string;
  status: "submitted" | "committed" | "failed";
  createdAt: string;
  detail: string | null;
}

/**
 * Local transaction history.
 *
 * The backend already tracks transactions, but a wallet action happens in the
 * browser: keeping a local copy means the Transactions page shows the write
 * immediately, even if the API has not seen it yet.
 *
 * This is a UI cache. The chain remains authoritative for the real status.
 */
export function readHistory(): LocalTransaction[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalTransaction);
  } catch {
    return [];
  }
}

function isLocalTransaction(value: unknown): value is LocalTransaction {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.txHash === "string" &&
    typeof entry.type === "string" &&
    typeof entry.createdAt === "string"
  );
}

export function addToHistory(entry: Omit<LocalTransaction, "createdAt">): void {
  const created: LocalTransaction = { ...entry, createdAt: new Date().toISOString() };
  // Newest first, de-duplicated by hash.
  const next = [
    created,
    ...readHistory().filter((row) => row.txHash !== created.txHash),
  ].slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing / quota: history is a convenience, not a requirement.
  }
}

export function updateHistoryStatus(
  txHash: string,
  status: LocalTransaction["status"],
): void {
  const next = readHistory().map((entry) =>
    entry.txHash === txHash ? { ...entry, status } : entry,
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface MergedTransaction {
  txHash: string;
  type: TransactionType;
  title: string;
  status: string;
  createdAt: string;
  source: "local" | "server";
}

/** Merges local history with the server list, de-duplicated by tx hash. */
export function mergeHistory(
  local: LocalTransaction[],
  remote: TransactionRecord[],
  titleFor: (record: TransactionRecord) => string,
): MergedTransaction[] {
  const merged = new Map<string, MergedTransaction>();

  for (const entry of local) {
    merged.set(entry.txHash, { ...entry, source: "local" });
  }

  // The server row overwrites the local one, so a confirmed status wins.
  for (const record of remote) {
    merged.set(record.txHash, {
      txHash: record.txHash,
      type: record.type,
      title: titleFor(record),
      status: record.status,
      createdAt: record.createdAt,
      source: "server",
    });
  }

  return [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

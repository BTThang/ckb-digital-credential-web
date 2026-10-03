import { getCkbClient } from "./client";

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Polls a transaction until the node commits or rejects it.
 *
 * Bounded on purpose: the loop always terminates, and a transient RPC failure
 * is treated as "still unknown" rather than as a rejection. A timeout returns
 * `pending`, never `failed` — a node outage must not be reported as a failed
 * transaction.
 */
export async function pollTransaction(
  txHash: string,
  { intervalMs = 2_000, timeoutMs = 120_000 }: PollOptions = {},
): Promise<"committed" | "pending" | "not_found"> {
  const client = getCkbClient();
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const response = await client.getTransaction(txHash);
      if (response?.status === "committed") return "committed";
      if (response?.status === "rejected") return "not_found";
    } catch {
      // A transient RPC failure is not a rejection; keep polling.
    }

    if (Date.now() >= deadline) return "pending";
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

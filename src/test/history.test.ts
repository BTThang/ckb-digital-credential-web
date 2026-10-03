import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addToHistory,
  clearHistory,
  mergeHistory,
  readHistory,
  updateHistoryStatus,
} from "@/services/transactions/local-history";
import type { TransactionRecord } from "@/types";

const record = (over: Partial<TransactionRecord> = {}): TransactionRecord => ({
  id: "tx_1",
  txHash: "0xaaa",
  credentialId: "cred_1",
  sporeId: "0xspore",
  type: "CREATE_CREDENTIAL",
  status: "committed",
  blockNumber: "100",
  detail: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("local transaction history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts empty and survives a corrupt payload", () => {
    expect(readHistory()).toEqual([]);
    localStorage.setItem("ckb-credential.tx-history.v1", "not json");
    expect(readHistory()).toEqual([]);
  });

  it("drops entries that are missing required fields", () => {
    localStorage.setItem(
      "ckb-credential.tx-history.v1",
      JSON.stringify([{ type: "CREATE_CREDENTIAL" }, record()]),
    );

    // Only the well-formed row survives the guard.
    expect(readHistory()).toHaveLength(1);
    expect(readHistory()[0]!.txHash).toBe("0xaaa");
  });

  it("stamps createdAt and keeps newest first", () => {
    addToHistory({
      txHash: "0xfirst",
      type: "CREATE_CREDENTIAL",
      credentialId: null,
      sporeId: null,
      title: "first",
      status: "submitted",
      detail: null,
    });
    addToHistory({
      txHash: "0xsecond",
      type: "TRANSFER_CREDENTIAL",
      credentialId: "cred_1",
      sporeId: "0xspore",
      title: "second",
      status: "submitted",
      detail: null,
    });

    const history = readHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.txHash).toBe("0xsecond");
    expect(history[0]!.createdAt).toBeTruthy();
  });

  it("updates a status in place", () => {
    addToHistory({
      txHash: "0xaaa",
      type: "CREATE_CREDENTIAL",
      credentialId: null,
      sporeId: null,
      title: "x",
      status: "submitted",
      detail: null,
    });
    updateHistoryStatus("0xaaa", "committed");

    expect(readHistory()[0]!.status).toBe("committed");
  });

  it("clears everything", () => {
    addToHistory({
      txHash: "0xaaa",
      type: "CREATE_CREDENTIAL",
      credentialId: null,
      sporeId: null,
      title: "x",
      status: "submitted",
      detail: null,
    });
    clearHistory();
    expect(readHistory()).toEqual([]);
  });
});

describe("mergeHistory", () => {
  it("prefers the server row and de-duplicates by hash", () => {
    const local = [
      {
        txHash: "0xaaa",
        type: "CREATE_CREDENTIAL" as const,
        credentialId: null,
        sporeId: null,
        title: "local title",
        status: "submitted" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        detail: null,
      },
    ];

    const merged = mergeHistory(local, [record()], (r) => `server ${r.id}`);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.source).toBe("server");
    expect(merged[0]!.status).toBe("committed");
  });

  it("keeps a local write the server has not seen yet", () => {
    const local = [
      {
        txHash: "0xlocal",
        type: "MELT_CREDENTIAL" as const,
        credentialId: null,
        sporeId: null,
        title: "local only",
        status: "submitted" as const,
        createdAt: "2026-01-02T00:00:00.000Z",
        detail: null,
      },
    ];

    const merged = mergeHistory(local, [record()], () => "x");

    expect(merged).toHaveLength(2);
    expect(merged[0]!.txHash).toBe("0xlocal");
  });

  it("sorts newest first", () => {
    const merged = mergeHistory(
      [],
      [
        record({ txHash: "0xold", createdAt: "2026-01-01T00:00:00.000Z" }),
        record({ txHash: "0xnew", createdAt: "2026-02-01T00:00:00.000Z" }),
      ],
      () => "x",
    );

    expect(merged.map((row) => row.txHash)).toEqual(["0xnew", "0xold"]);
  });
});

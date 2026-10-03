import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import CopyButton from "@/components/CopyButton";
import { Alert, Card, EmptyState, Hash, Spinner, StatusBadge } from "@/components/ui";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import {
  clearHistory,
  mergeHistory,
  readHistory,
  updateHistoryStatus,
} from "@/services/transactions/local-history";
import type { TransactionStatus } from "@/types";
import { txExplorerUrl } from "@/utils/explorer";
import { formatDateTime, humanizeToken } from "@/utils/format";
import { isTxHash } from "@/utils/validation";

/** Local + server rows, de-duplicated by transaction hash. */
function useMergedTransactions() {
  const remote = useAsync(() => api.listTransactions(50), []);
  const [local, setLocal] = useState(readHistory);

  return {
    rows: mergeHistory(local, remote.data?.data ?? [], (record) => {
      const match = local.find((entry) => entry.txHash === record.txHash);
      return match?.title ?? record.credentialId ?? record.sporeId ?? "Credential";
    }),
    remote,
    local,
    setLocal,
  };
}

export default function TransactionsPage() {
  const [lookup, setLookup] = useState("");
  const [hash, setHash] = useState("");
  const { rows, remote, local, setLocal } = useMergedTransactions();

  const detail = useAsync(
    () => api.getTransaction(hash),
    [hash],
    { enabled: isTxHash(hash) },
  );

  async function refreshStatus(txHash: string) {
    try {
      const report = await api.getTransaction(txHash);
      const status = report.status as "committed" | "failed" | "submitted";
      updateHistoryStatus(txHash, status);
      setLocal(readHistory());
      remote.reload();
    } catch {
      // Leave the row as-is; the next manual refresh can try again.
    }
  }

  function handleLookup(event: FormEvent) {
    event.preventDefault();
    setHash(lookup.trim().toLowerCase());
  }

  return (
    <>
      <div className="page-header">
        <h1>Transactions</h1>
        <p>
          Wallet writes are shown from this browser's history and from the
          server's tracking table. Both are hints — the chain decides the real
          status, which you can look up below.
        </p>
      </div>

      <Card>
        <div className="card-title">
          <h2>Look up a transaction</h2>
        </div>
        <form onSubmit={handleLookup} className="stack-sm">
          <div className="field">
            <label htmlFor="tx-lookup">Transaction hash</label>
            <input
              id="tx-lookup"
              className="mono"
              value={lookup}
              spellCheck={false}
              placeholder="0x…"
              onChange={(event) => setLookup(event.target.value)}
            />
            {lookup && !isTxHash(lookup.trim()) ? (
              <span className="hint">That is not a 32-byte transaction hash.</span>
            ) : null}
          </div>
          <div className="row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isTxHash(lookup.trim())}
            >
              Check chain status
            </button>
          </div>
        </form>

        {hash && detail.loading ? <Spinner label="Asking the node…" /> : null}

        {detail.error ? (
          <div style={{ marginTop: 16 }}>
            <Alert kind="warning" title="Could not read the chain">
              {detail.error} This is not the same as the transaction failing.
            </Alert>
          </div>
        ) : null}

        {detail.data ? (
          <div style={{ marginTop: 16 }}>
            <div className="spread">
              <div className="row">
                <StatusBadge value={detail.data.status} />
                <span className="small muted">
                  {detail.data.found ? "found on chain" : "not known to the node"}
                </span>
              </div>
              {detail.data.inSync === false ? (
                <span className="badge badge-pending">index out of sync</span>
              ) : null}
            </div>

            <dl className="dl" style={{ marginTop: 12 }}>
              <dt>Transaction</dt>
              <dd className="break">
                <a
                  href={txExplorerUrl(detail.data.txHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {detail.data.txHash}
                </a>{" "}
                <CopyButton value={detail.data.txHash} />
              </dd>
              <dt>Chain status</dt>
              <dd>{detail.data.chain.status ?? "—"}</dd>
              <dt>Block</dt>
              <dd>{detail.data.chain.blockNumber ?? "—"}</dd>
              <dt>Inputs / outputs</dt>
              <dd>
                {detail.data.chain.inputCount ?? "—"} /{" "}
                {detail.data.chain.outputCount ?? "—"}
              </dd>
              {detail.data.chain.reason ? (
                <>
                  <dt>Reason</dt>
                  <dd>{detail.data.chain.reason}</dd>
                </>
              ) : null}
            </dl>
          </div>
        ) : null}
      </Card>

      <div className="card-title" style={{ marginTop: 28 }}>
        <h2>Activity</h2>
        <div className="row">
          <button
            type="button"
            className="btn btn-sm"
            disabled={remote.loading}
            onClick={() => {
              setLocal(readHistory());
              remote.reload();
            }}
          >
            Refresh
          </button>
          {local.length > 0 ? (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                clearHistory();
                setLocal([]);
              }}
            >
              Clear local history
            </button>
          ) : null}
        </div>
      </div>

      {remote.error ? (
        <Alert kind="error" title="Could not load transactions">
          <p>{remote.error}</p>
          <p className="alert-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={remote.reload}
              disabled={remote.loading}
            >
              {remote.loading ? "Retrying…" : "Retry"}
            </button>
          </p>
        </Alert>
      ) : null}

      {rows.length === 0 && !remote.loading ? (
        <EmptyState icon="⇄" title="No transactions yet">
          Issued, transferred and melted credentials from this browser will show
          up here.
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Transaction</th>
                <th scope="col">Type</th>
                <th scope="col">Credential</th>
                <th scope="col">Status</th>
                <th scope="col">When</th>
                <th scope="col">Source</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.txHash}>
                  <td>
                    <Hash
                      value={row.txHash}
                      href={txExplorerUrl(row.txHash)}
                    />
                  </td>
                    <td>{humanizeToken(row.type)}</td>
                  <td>{row.title}</td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>
                    <span className="badge">{row.source}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void refreshStatus(row.txHash)}
                    >
                      Check
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="muted small" style={{ marginTop: 18 }}>
        Status meanings: <strong>submitted</strong> — the node accepted it, not
        confirmed yet; <strong>pending</strong> — in the mempool;{" "}
        <strong>committed</strong> — final on chain; <strong>failed</strong> —
        rejected or never known to the node. A node outage is reported
        separately and never shown as “failed”.
      </p>

      <p className="small">
        <Link to="/verify">Verify a Spore id</Link> to confirm a credential
        without trusting any table on this page.
      </p>
    </>
  );
}

export type { TransactionStatus };

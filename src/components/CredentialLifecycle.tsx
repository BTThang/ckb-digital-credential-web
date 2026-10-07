import { Alert, Card, Spinner, StatusBadge } from "@/components/ui";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import type { Credential, TransactionStatus, TransactionType } from "@/types";
import { txExplorerUrl } from "@/utils/explorer";
import { formatDate, formatDateTime } from "@/utils/format";
import { lifecycleState, type LifecycleState } from "@/utils/lifecycle";

const TYPE_LABELS: Record<TransactionType, string> = {
  CREATE_CREDENTIAL: "Issued",
  TRANSFER_CREDENTIAL: "Transferred",
  MELT_CREDENTIAL: "Melted (revoked)",
};

const STATE_NOTES: Record<LifecycleState, string> = {
  ACTIVE: "Currently held by the recipient and valid on chain.",
  TRANSFERRED:
    "The cell moved to a new owner. A transfer keeps the credential valid; the issuer and issue date are unchanged.",
  REVOKED:
    "The Spore cell was melted, so this id no longer exists on chain. Verification reports it as not found.",
  NOT_FOUND:
    "The index cannot currently see the cell on chain. The network is authoritative, so verify the id before trusting this row.",
};

interface LifecycleEvent {
  key: string;
  title: string;
  detail: string | null;
  txHash: string;
  when: string;
  status: TransactionStatus | null;
}

/**
 * The history of one credential: every indexed wallet write, oldest first.
 *
 * Falls back to a synthetic "Issued" event built from the record when the index
 * has no transaction rows (older data), so the timeline is never empty for a
 * credential that provably exists.
 */
export default function CredentialLifecycle({
  credential,
}: {
  credential: Credential;
}) {
  const history = useAsync(
    () => api.listTransactions(50, 0, credential.sporeId),
    [credential.sporeId],
  );

  const rows = history.data?.data ?? [];
  const events: LifecycleEvent[] = rows.length
    ? rows.map((row) => ({
        key: row.id,
        title: TYPE_LABELS[row.type] ?? row.type,
        detail: row.detail,
        txHash: row.txHash,
        when: row.createdAt,
        status: row.status,
      }))
    : [
        {
          key: "issued",
          title: "Issued",
          detail: credential.issuerName,
          txHash: credential.creationTxHash,
          when: credential.issueDate,
          status: null,
        },
      ];

  const state = lifecycleState(credential);
  const dead = state === "REVOKED" || state === "NOT_FOUND";

  return (
    <Card>
      <div className="card-title">
        <h2>Lifecycle</h2>
        <StatusBadge value={dead ? "melted" : "active"} label={state} />
      </div>

      <p className="muted small" style={{ marginBottom: 14 }}>
        {STATE_NOTES[state]}
      </p>

      {history.error ? (
        <Alert kind="warning" title="History unavailable">
          {history.error} The events below come from the index and do not decide
          validity.
        </Alert>
      ) : null}

      {history.loading && rows.length === 0 ? (
        <Spinner label="Loading history…" />
      ) : null}

      <ol className="timeline" data-state={state}>
        {events.map((event) => (
          <li key={event.key} className="timeline-item">
            <div className="timeline-marker" aria-hidden="true" />
            <div className="timeline-body">
              <div className="spread">
                <strong>{event.title}</strong>
                {event.status ? (
                  <StatusBadge value={event.status} />
                ) : (
                  <span className="small muted">from the index</span>
                )}
              </div>
              {event.detail ? (
                <p className="small muted" style={{ margin: "4px 0 0" }}>
                  {event.detail}
                </p>
              ) : null}
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                <a
                  href={txExplorerUrl(event.txHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {event.txHash}
                </a>{" "}
                · {formatDateTime(event.when)}
              </p>
            </div>
          </li>
        ))}

        <li className="timeline-item">
          <div className="timeline-marker" aria-hidden="true" />
          <div className="timeline-body">
            <div className="spread">
              <strong>Current state</strong>
              <StatusBadge value={dead ? "melted" : "active"} label={state} />
            </div>
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              Owner {credential.ownerAddress} · issued{" "}
              {formatDate(credential.issueDate)}
            </p>
          </div>
        </li>
      </ol>
    </Card>
  );
}
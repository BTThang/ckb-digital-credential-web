import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import CopyButton from "@/components/CopyButton";
import CredentialLifecycle from "@/components/CredentialLifecycle";
import Dialog from "@/components/Dialog";
import ShareQrButton from "@/components/ShareQrButton";
import { Alert, Card, Hash, Spinner, StatusBadge } from "@/components/ui";
import { useWallet } from "@/context/WalletProvider";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import { meltCredential, transferCredential } from "@/services/credentials";
import type { VerificationReport } from "@/types";
import { txExplorerUrl, addressExplorerUrl } from "@/utils/explorer";
import { formatDate, formatDateTime, humanizeToken, isExpired } from "@/utils/format";
import { isCkbAddress } from "@/utils/validation";

type DialogKind = "none" | "transfer" | "melt";

export default function CredentialDetailPage() {
  const { id = "" } = useParams();
  const { signer, address } = useWallet();

  const [dialog, setDialog] = useState<DialogKind>("none");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const credential = useAsync(() => api.getCredential(id), [id]);
  const verification = useAsync<VerificationReport | null>(
    () => (id ? api.verifyCredential(id) : Promise.resolve(null)),
    [id],
  );

  const record = credential.data;
  const isOwner = Boolean(record && address && record.ownerAddress === address);
  const expired = isExpired(record?.expirationDate);
  const canWrite = Boolean(signer && isOwner && record && record.status === "active" && !expired);

  function closeDialog() {
    setDialog("none");
    setActionError(null);
    setRecipient("");
  }

  /** Runs a wallet write and refreshes whatever the chain may have changed. */
  async function runWrite(action: () => Promise<string>) {
    setBusy(true);
    setActionError(null);
    try {
      const txHash = await action();
      setResult(txHash);
      closeDialog();
      credential.reload();
      verification.reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The wallet rejected the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function doTransfer() {
    if (!record || !signer) return;
    const target = recipient.trim();
    if (!isCkbAddress(target))
      return setActionError("Enter a valid CKB address.");

    await runWrite(() =>
      transferCredential({
        signer,
        sporeId: record.sporeId,
        to: target,
        credentialId: record.id,
        title: record.title,
      }),
    );
  }

  async function doMelt() {
    if (!record || !signer) return;

    await runWrite(() =>
      meltCredential({
        signer,
        sporeId: record.sporeId,
        credentialId: record.id,
        title: record.title,
      }),
    );
  }

  if (credential.loading) return <Spinner label="Loading credential…" />;

  if (credential.error || !record) {
    return (
      <Card>
        <Alert kind="error" title="Credential not found">
          {credential.error ?? "The index has no credential with this id."}
        </Alert>
        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn btn-sm" to="/credentials">
            Back to credentials
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="spread">
          <div>
            <h1>{record.title}</h1>
            <div className="row">
              <StatusBadge value={record.status} />
              {isOwner ? <span className="badge badge-verified">yours</span> : null}
              {expired ? <span className="badge badge-failed">expired</span> : null}
            </div>
          </div>
          <div className="row-end">
            <Link className="btn btn-sm" to="/credentials">
              All credentials
            </Link>
            {canWrite ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setDialog("transfer")}
                >
                  Transfer
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setDialog("melt")}
                >
                  Melt
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {result ? (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="success" title="Transaction submitted">
            <code className="break">{result}</code>{" "}
            <a href={txExplorerUrl(result)} target="_blank" rel="noreferrer noopener">
              View on explorer
            </a>
          </Alert>
        </div>
      ) : null}

      {record.status === "melted" ? (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="warning" title="Melted">
            The Spore cell was destroyed, so this credential no longer exists on
            chain. The row below is kept for history only.
          </Alert>
        </div>
      ) : null}

      <div className="stack">
        <Card>
          <div className="card-title">
            <h2>Details</h2>
          </div>
          {record.description ? (
            <p>{record.description}</p>
          ) : (
            <p className="muted small">No description was provided.</p>
          )}

          <dl className="dl">
            <dt>Issuer</dt>
            <dd>
              {record.issuerName}{" "}
              <span className="muted small">
                ({humanizeToken(record.issuerType)})
              </span>
            </dd>
            <dt>Issuer address</dt>
            <dd className="break">
              <a
                href={addressExplorerUrl(record.issuerAddress)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {record.issuerAddress}
              </a>
            </dd>
            <dt>Type</dt>
            <dd>{humanizeToken(record.credentialType)}</dd>
            <dt>Issued</dt>
            <dd>{formatDate(record.issueDate)}</dd>
            <dt>Expires</dt>
            <dd>
              {record.expirationDate ? formatDate(record.expirationDate) : "never"}
            </dd>
            <dt>Network</dt>
            <dd>{record.network}</dd>
          </dl>
        </Card>

        <Card>
          <div className="card-title">
            <h2>On-chain record</h2>
            <div className="row">
              <ShareQrButton sporeId={record.sporeId} label="QR code" />
              <Link
                className="btn btn-sm"
                to={`/verify?sporeId=${encodeURIComponent(record.sporeId)}`}
              >
                Full verification
              </Link>
            </div>
          </div>

          <dl className="dl">
            <dt>Spore id</dt>
            <dd className="break">
              <code>{record.sporeId}</code> <CopyButton value={record.sporeId} />
            </dd>
            <dt>Owner</dt>
            <dd className="break">
              <a
                href={addressExplorerUrl(record.ownerAddress)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {record.ownerAddress}
              </a>
            </dd>
            <dt>Recipient at issue</dt>
            <dd className="break">
              <a
                href={addressExplorerUrl(record.recipientAddress)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {record.recipientAddress}
              </a>
            </dd>
            <dt>Creation tx</dt>
            <dd className="break">
              <a
                href={txExplorerUrl(record.creationTxHash)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {record.creationTxHash}
              </a>
            </dd>
            <dt>Indexed</dt>
            <dd>{formatDateTime(record.updatedAt)}</dd>
          </dl>
        </Card>

        <CredentialLifecycle credential={record} />

        <Card>
          <div className="card-title">
            <h2>Chain verification</h2>
            {verification.loading ? <span className="spinner" aria-hidden="true" /> : null}
          </div>

          {verification.error ? (
            <Alert kind="error" title="Verification unavailable">
              {verification.error}
            </Alert>
          ) : null}

          {verification.data ? (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <StatusBadge value={verification.data.state} />
                <span className="small muted">
                  checked {formatDateTime(verification.data.verification.checkedAt)}
                </span>
              </div>

              <dl className="dl">
                <dt>Spore exists</dt>
                <dd>{verification.data.verification.sporeExists ? "yes" : "no"}</dd>
                <dt>Chain owner</dt>
                <dd className="break">
                  {verification.data.verification.currentOwner ?? "—"}
                </dd>
                <dt>Capacity</dt>
                <dd>
                  {verification.data.verification.capacity
                    ? `${verification.data.verification.capacity} CKB`
                    : "—"}
                </dd>
                <dt>Reason</dt>
                <dd>{verification.data.verification.reason ?? "—"}</dd>
              </dl>

              {verification.data.indexed ? (
                <div style={{ marginTop: 14 }}>
                  <Alert
                    kind={
                      verification.data.indexed.reconciled ? "success" : "warning"
                    }
                    title={
                      verification.data.indexed.reconciled
                        ? "Index agrees with the chain"
                        : "Index differs from the chain"
                    }
                  >
                    {verification.data.indexed.reconciled
                      ? "The cached row matches the live cell."
                      : `Cached owner ${verification.data.indexed.ownerInDatabase} vs chain owner ${
                          verification.data.verification.currentOwner ?? "none"
                        }. The chain is authoritative.`}
                  </Alert>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="row small muted" style={{ marginTop: 12 }}>
            <span title={record.creationTxHash}>
              creation tx{" "}
              <Hash value={record.creationTxHash} href={txExplorerUrl(record.creationTxHash)} />
            </span>
          </div>
        </Card>
      </div>

      {dialog === "transfer" ? (
        <Dialog
          title="Transfer credential"
          busy={busy}
          error={actionError}
          confirmLabel="Transfer"
          onCancel={closeDialog}
          onConfirm={() => void doTransfer()}
        >
          <p className="muted small" style={{ margin: 0 }}>
            The Spore cell moves to the new lock. The payload is unchanged, so the
            credential keeps its issuer and issue date.
          </p>
          <div className="field">
            <label htmlFor="transfer-to">New owner address</label>
            <input
              id="transfer-to"
              value={recipient}
              autoFocus
              placeholder="ckt1…"
              onChange={(event) => setRecipient(event.target.value)}
            />
          </div>
        </Dialog>
      ) : null}

      {dialog === "melt" ? (
        <Dialog
          title="Melt credential"
          busy={busy}
          error={actionError}
          confirmLabel="Melt permanently"
          danger
          onCancel={closeDialog}
          onConfirm={() => void doMelt()}
        >
          <p className="muted small" style={{ margin: 0 }}>
            Melting destroys the Spore cell. There is no way to bring it back,
            and anyone verifying this id afterwards will be told it does not
            exist.
          </p>
        </Dialog>
      ) : null}
    </>
  );
}

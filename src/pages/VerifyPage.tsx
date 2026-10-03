import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CopyButton from "@/components/CopyButton";
import { Alert, Card, Spinner, StatusBadge } from "@/components/ui";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import type { SporeVerification } from "@/types";
import { addressExplorerUrl, txExplorerUrl } from "@/utils/explorer";
import { formatDate, formatDateTime, humanizeToken } from "@/utils/format";
import { isSporeId } from "@/utils/validation";

const STATE_COPY: Record<
  string,
  { kind: "success" | "error" | "warning"; title: string; body: string }
> = {
  verified: {
    kind: "success",
    title: "Verified on chain",
    body: "The Spore cell exists and its payload decodes to a credential. This answer comes from the live cell, not from the index.",
  },
  not_found: {
    kind: "error",
    title: "Not found on chain",
    body: "No live Spore cell has this id. It was either never issued, or it has been melted.",
  },
  unable_to_verify: {
    kind: "warning",
    title: "Unable to verify",
    body: "The CKB node could not be queried. This is not the same as “not found” — the credential's existence is simply unknown right now.",
  },
};

function VerificationFacts({ verification }: { verification: SporeVerification }) {
  const facts: Array<[string, React.ReactNode]> = [
    ["Spore id", <code className="break">{verification.sporeId}</code>],
    ["Spore exists", verification.sporeExists ? "yes" : "no"],
    [
      "Current owner",
      verification.currentOwner ? (
        <a
          href={addressExplorerUrl(verification.currentOwner)}
          target="_blank"
          rel="noreferrer noopener"
          className="break"
        >
          {verification.currentOwner}
        </a>
      ) : (
        "—"
      ),
    ],
    [
      "Creation tx",
      <a
        href={txExplorerUrl(verification.creationTxHash)}
        target="_blank"
        rel="noreferrer noopener"
        className="break"
      >
        {verification.creationTxHash}
      </a>,
    ],
    ["Creation tx status", verification.creationTxStatus ?? "—"],
    ["Block", verification.blockNumber ?? "—"],
    [
      "Capacity",
      verification.capacity ? `${verification.capacity} CKB` : "—",
    ],
    ["Content type", verification.contentType ?? "—"],
    ["Checked at", formatDateTime(verification.checkedAt)],
    ["Network", verification.network],
  ];

  if (verification.reason) facts.push(["Reason", verification.reason]);

  return (
    <>
      <dl className="dl">
        {facts.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {verification.content ? (
        <div style={{ marginTop: 16 }}>
          <h3>Payload decoded from the cell</h3>
          <dl className="dl">
            <dt>Title</dt>
            <dd>{verification.content.title}</dd>
            <dt>Description</dt>
            <dd>{verification.content.description || "—"}</dd>
            <dt>Issuer</dt>
            <dd>
              {verification.content.issuerName}{" "}
              <span className="muted small">
                ({humanizeToken(verification.content.issuerType)})
              </span>
            </dd>
            <dt>Type</dt>
            <dd>{humanizeToken(verification.content.credentialType)}</dd>
            <dt>Issued</dt>
            <dd>{formatDate(verification.content.issueDate)}</dd>
            <dt>Expires</dt>
            <dd>
              {verification.content.expirationDate
                ? formatDate(verification.content.expirationDate)
                : "never"}
            </dd>
          </dl>
        </div>
      ) : null}
    </>
  );
}
export default function VerifyPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get("sporeId") ?? "");
  const [submitted, setSubmitted] = useState(params.get("sporeId") ?? "");

  const valid = isSporeId(submitted);

  const report = useAsync(
    () => api.verifySporeId(submitted),
    [submitted],
    { enabled: valid },
  );

  const lookup = useAsync(
    () => api.lookupSpore(submitted),
    [submitted],
    { enabled: valid },
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    setSubmitted(value);
    setParams(value ? { sporeId: value } : {}, { replace: true });
  }

  const state = report.data?.state;
  const copy = state ? STATE_COPY[state] : undefined;

  return (
    <>
      <div className="page-header">
        <h1>Verify a credential</h1>
        <p>
          Paste a Spore id to read the live cell from CKB. The result is
          chain-anchored: a row in the local database can never make a credential
          look valid.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="stack-sm">
          <div className="field">
            <label htmlFor="spore-id">Spore id</label>
            <input
              id="spore-id"
              className="mono"
              value={input}
              spellCheck={false}
              placeholder="0x…"
              onChange={(event) => setInput(event.target.value)}
            />
            <span className="hint">
              A Spore id is 32 bytes of hex — the cell&apos;s type script args.
              It is not a transaction hash and not a cell outpoint.
            </span>
          </div>
          <div className="row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim()}
            >
              Verify
            </button>
            {submitted ? (
              <CopyButton value={submitted} label="Copy id" />
            ) : null}
          </div>
        </form>
      </Card>

      {submitted && !valid ? (
        <div style={{ marginTop: 18 }}>
          <Alert kind="error" title="That is not a Spore id">
            A Spore id is <code>0x</code> followed by 64 hex characters. The
            issuing screen shows the id for every credential it creates.
          </Alert>
        </div>
      ) : null}

      {valid ? (
        <div style={{ marginTop: 18 }}>
          {report.loading ? <Spinner label="Reading the live cell…" /> : null}

          {report.error ? (
            <Alert kind="error" title="Verification failed">
              {report.error}
            </Alert>
          ) : null}

          {report.data && copy ? (
            <div className="stack">
              <Card>
                <div className="card-title">
                  <h2>Result</h2>
                  <StatusBadge value={report.data.state} />
                </div>
                <Alert kind={copy.kind} title={copy.title}>
                  {copy.body}
                </Alert>
                <div style={{ marginTop: 16 }}>
                  <VerificationFacts verification={report.data.verification} />
                </div>
              </Card>

              {report.data.verification.creationTxStatus ? (
                <Card>
                  <div className="card-title">
                    <h3>Creation transaction</h3>
                  </div>
                  <dl className="dl">
                    <dt>Status</dt>
                    <dd>{report.data.verification.creationTxStatus}</dd>
                    <dt>Block</dt>
                    <dd>{report.data.verification.blockNumber ?? "—"}</dd>
                    <dt>
                      <a
                        href={txExplorerUrl(
                          report.data.verification.creationTxHash,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on explorer
                      </a>
                    </dt>
                  </dl>
                </Card>
              ) : null}

              {lookup.data ? (
                <Card>
                  <div className="card-title">
                    <h3>Indexed credential</h3>
                    <Link
                      className="btn btn-sm"
                      to={`/credentials/${lookup.data.id}`}
                    >
                      Open detail
                    </Link>
                  </div>
                  <p className="muted small" style={{ marginTop: 0 }}>
                    The index knows about this Spore. Compare its status with the
                    chain result above — the chain wins.
                  </p>
                  <dl className="dl">
                    <dt>Title</dt>
                    <dd>{lookup.data.title}</dd>
                    <dt>Indexed status</dt>
                    <dd>{lookup.data.status}</dd>
                    <dt>Indexed owner</dt>
                    <dd className="break">{lookup.data.ownerAddress}</dd>
                  </dl>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

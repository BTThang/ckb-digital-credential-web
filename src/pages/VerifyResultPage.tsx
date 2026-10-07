import { Link, useParams } from "react-router-dom";

import { Alert, Card, Hash, Spinner, StatusBadge } from "@/components/ui";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import type { PublicVerification } from "@/types";
import { addressExplorerUrl, txExplorerUrl } from "@/utils/explorer";
import { formatDate, formatDateTime, humanizeToken } from "@/utils/format";
import { isSporeId, normalizeSporeId } from "@/utils/validation";

/**
 * The three verdicts a verifier is allowed to see, mapped from the backend's
 * public state vocabulary. `unable_to_verify` and API failures are
 * infrastructure answers and are never shown as a credential verdict.
 */
type Verdict = "valid" | "invalid" | "not_found" | "error";

const VERDICT_COPY: Record<
  Verdict,
  { kind: "success" | "error" | "warning"; title: string; body: string }
> = {
  valid: {
    kind: "success",
    title: "CREDENTIAL VERIFIED",
    body: "This answer was read from the live Spore cell on CKB. It does not come from any application database.",
  },
  invalid: {
    kind: "error",
    title: "CREDENTIAL INVALID",
    body: "The credential exists on chain but does not satisfy the validity rules.",
  },
  not_found: {
    kind: "error",
    title: "CREDENTIAL NOT FOUND",
    body: "No live Spore cell has this id on CKB. It was never issued, or it has been melted and no longer exists.",
  },
  error: {
    kind: "warning",
    title: "VERIFICATION UNAVAILABLE",
    body: "The CKB node could not be queried right now. This says nothing about the credential — try again in a moment.",
  },
};

/** The verdict is decided by the backend; this only maps its vocabulary. */
function verdictOf(
  data: PublicVerification | null | undefined,
  failure: string | null,
): Verdict {
  if (failure || !data) return "error";
  if (data.state === "unable_to_verify") return "error";
  if (data.state === "not_found") return "not_found";
  if (data.valid) return "valid";
  return "invalid";
}

/**
 * A lifecycle-style label for the badge. `blockchain.status` stays "active"
 * for an expired cell, so this derives a status that matches the verdict the
 * user is looking at instead of the raw chain flag.
 */
function statusLabel(data: PublicVerification): string {
  if (data.valid) return "active";
  if (data.state === "not_found") return "not_found";
  if (data.state === "unable_to_verify") return "unknown";
  return "invalid";
}

function invalidReason(data: PublicVerification): string {
  if (data.reason) return data.reason;
  return "It does not satisfy the validity rules.";
}

function Facts({ verification }: { verification: PublicVerification }) {
  const { credential, blockchain } = verification;

  return (
    <dl className="dl">
      <dt>Credential</dt>
      <dd>{credential ? (credential.title ?? "—") : "—"}</dd>

      <dt>Type</dt>
      <dd>{credential?.type ? humanizeToken(credential.type) : "—"}</dd>

      <dt>Issuer</dt>
      <dd>
        {credential?.issuer ? (
          <>
            {credential.issuer.name}{" "}
            <span className="muted small">
              ({credential.issuer.type ? humanizeToken(credential.issuer.type) : "unknown type"})
            </span>
          </>
        ) : (
          "—"
        )}
      </dd>

      <dt>Holder</dt>
      <dd>
        {credential?.holder ? (
          <a
            href={addressExplorerUrl(credential.holder)}
            target="_blank"
            rel="noreferrer noopener"
            className="break"
          >
            {credential.holder}
          </a>
        ) : (
          "—"
        )}
      </dd>

      <dt>Issued</dt>
      <dd>{credential?.issuedAt ? formatDate(credential.issuedAt) : "—"}</dd>

      <dt>Expires</dt>
      <dd>
        {credential?.expiresAt
          ? formatDate(credential.expiresAt)
          : credential
            ? "never"
            : "—"}
      </dd>

      <dt>Spore ID</dt>
      <dd>
        <Hash value={blockchain.sporeId} head={12} tail={10} />
      </dd>

      <dt>Network</dt>
      <dd>CKB Testnet ({blockchain.network})</dd>

      <dt>Source</dt>
      <dd>{verification.source === "ckb" ? "CKB on-chain state" : verification.source}</dd>

      {blockchain.creationTxHash ? (
        <>
          <dt>Creation transaction</dt>
          <dd>
            <a
              href={txExplorerUrl(blockchain.creationTxHash)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Hash value={blockchain.creationTxHash} head={10} tail={8} />
            </a>
          </dd>
        </>
      ) : null}

      <dt>Checked at</dt>
      <dd>{formatDateTime(verification.checkedAt)}</dd>
    </dl>
  );
}

/**
 * The public verification page: `/verify/:credentialId`.
 *
 * Deliberately unauthenticated — no session, no wallet, no account — and it
 * only ever asks the backend's public verification API, which reads CKB.
 * `credentialId` is the Spore id (0x + 64 hex), the same identifier the QR
 * code and the verification API use.
 */
export default function VerifyResultPage() {
  const { credentialId = "" } = useParams();
  const sporeId = normalizeSporeId(credentialId);
  const wellFormed = isSporeId(sporeId);

  const report = useAsync(() => api.verifyCredentialId(sporeId), [sporeId], {
    enabled: wellFormed,
  });

  const verdict = verdictOf(report.data, report.error);
  const copy = VERDICT_COPY[verdict];

  return (
    <>
      <div className="page-header">
        <h1>Credential verification</h1>
        <p>
          Public verification, read directly from CKB. No login, no wallet and
          no application database stand between the chain and this answer.
        </p>
      </div>

      {!wellFormed ? (
        <Alert kind="error" title="That is not a credential id">
          A credential id is a Spore id: <code>0x</code> followed by 64 hex
          characters. <Link to="/verify">Verify an id instead</Link>.
        </Alert>
      ) : null}

      {wellFormed && report.loading ? (
        <Card>
          <Spinner label="Reading the live cell from CKB…" />
        </Card>
      ) : null}

      {wellFormed && !report.loading ? (
        <div className="stack">
          <Card>
            <div className="card-title">
              <h2>Result</h2>
              {report.data ? (
                <StatusBadge value={statusLabel(report.data)} />
              ) : null}
            </div>

            <Alert kind={copy.kind} title={copy.title}>
              {copy.body}
            </Alert>

            {verdict === "invalid" && report.data ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {invalidReason(report.data)}
              </p>
            ) : null}

            {report.data ? (
              <div style={{ marginTop: 16 }}>
                <Facts verification={report.data} />
              </div>
            ) : null}

            <p className="muted small" style={{ marginBottom: 0 }}>
              {verdict === "valid"
                ? "Verified directly from CKB."
                : verdict === "error"
                  ? "Infrastructure state, not a verdict on the credential."
                  : "Verified directly from CKB — the chain is the source of truth."}
            </p>
          </Card>

          <Card>
            <div className="card-title">
              <h3>This URL is shareable</h3>
            </div>
            <p className="muted small" style={{ marginTop: 0 }}>
              Anyone with this link sees the same chain-derived result, with no
              account required.
            </p>
            <Link className="btn btn-sm" to="/verify">
              Verify another id
            </Link>
          </Card>
        </div>
      ) : null}
    </>
  );
}
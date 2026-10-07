import { Link } from "react-router-dom";

import { NETWORK } from "@/config";
import { useHealth } from "@/context/HealthProvider";
import { useWallet } from "@/context/WalletProvider";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import { Alert, Card, Spinner, StatTile, StatusBadge } from "@/components/ui";

const STEPS = [
  {
    title: "1. Issue",
    body: "The issuer writes the credential into a Spore cell. The cell's lock script is the owner, so the recipient is the real holder from the first block.",
  },
  {
    title: "2. Own & transfer",
    body: "Transfers move the same Spore cell to a new lock. The payload never changes, and ownership always follows the chain.",
  },
  {
    title: "3. Verify",
    body: "Anyone can check a Spore id. Verification reads the live cell from CKB; the local index is only ever shown as context.",
  },
  {
    title: "4. Melt",
    body: "Melt destroys the Spore cell. On chain the credential stops existing, which is what a revocation looks like.",
  },
];

/** The three roles from the product model. Only the verifier needs no account. */
const ROLES = [
  {
    role: "Issuer",
    body: "A company, school or organizer signs a credential into a Spore cell and can track everything it issued.",
    to: "/issue",
    cta: "Issue a credential",
  },
  {
    role: "Holder",
    body: "The wallet that owns the cell. A holder presents the credential, shares a QR code, and can transfer it on.",
    to: "/my",
    cta: "My credentials",
  },
  {
    role: "Verifier",
    body: "Anyone checking a credential — no account, wallet or signature. Open the verification URL, scan a QR, or call the public API.",
    to: "/verify",
    cta: "Verify a credential",
  },
];

export default function HomePage() {
  const { address, signer } = useWallet();
  const { health } = useHealth();
  const credentials = useAsync(
    () => api.listCredentials({ limit: 5 }),
    [address],
    { enabled: Boolean(address) },
  );

  const owned = credentials.data?.data.length ?? 0;
  const total = credentials.data?.total ?? 0;

  return (
    <>
      <div className="page-header">
        <h1>On-chain credentials for CKB</h1>
        <p>
          A credential is a Spore cell on Nervos CKB. It is issued to an owner,
          can be transferred, verified by anyone, and destroyed with a melt. The
          backend only reads and indexes the chain; every write is signed in
          your browser.
        </p>
        <div className="row hero-actions">
          <Link className="btn btn-primary" to="/issue">
            Issue a credential
          </Link>
          <Link className="btn" to="/verify">
            Verify a Spore id
          </Link>
          <Link className="btn" to="/credentials">
            Browse credentials
          </Link>
        </div>
      </div>

      {/* At-a-glance numbers first, then the detail panels. */}
      <div className="grid stat-grid">
        <StatTile
          label="Network"
          value={<span className="stat-text">{health?.chain.network ?? NETWORK}</span>}
          hint={health?.status ?? "checking…"}
        />
        <StatTile
          label="Indexer"
          value={
            <span className="stat-text">
              {health?.chain.reachable === false ? "offline" : "online"}
            </span>
          }
          hint={health ? `tip ${health.chain.tipBlockNumber ?? "—"}` : "contacting…"}
        />
        <StatTile
          label="Credentials"
          value={address ? (credentials.loading ? "…" : total) : "—"}
          hint={address ? `${owned} shown recently` : "connect a wallet"}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <Card>
          <div className="card-title">
            <h2>Network</h2>
            <StatusBadge value={health?.status === "degraded" ? "failed" : "active"}>
              {health?.status ?? "unknown"}
            </StatusBadge>
          </div>
          {health ? (
            <dl className="dl">
              <dt>Chain</dt>
              <dd>{health.chain.network}</dd>
              <dt>RPC</dt>
              <dd>
                <code>{health.chain.rpcUrl}</code>
              </dd>
              <dt>Reachable</dt>
              <dd>{health.chain.reachable ? "yes" : "no"}</dd>
              <dt>Tip block</dt>
              <dd>{health.chain.tipBlockNumber ?? "—"}</dd>
            </dl>
          ) : (
            <Spinner label="Contacting the indexer…" />
          )}
        </Card>

        <Card>
          <div className="card-title">
            <h2>Your wallet</h2>
            <StatusBadge value={signer ? "active" : "pending"}>
              {signer ? "connected" : "not connected"}
            </StatusBadge>
          </div>
          {address ? (
            <>
              <dl className="dl">
                <dt>Address</dt>
                <dd className="break">
                  <code>{address}</code>
                </dd>
                <dt>Indexed credentials</dt>
                <dd>
                  {credentials.loading ? "…" : `${total} (${owned} recent shown)`}
                </dd>
              </dl>
              <div className="row" style={{ marginTop: 12 }}>
                <Link className="btn btn-primary btn-sm" to="/issue">
                  Issue credential
                </Link>
                <Link className="btn btn-sm" to="/credentials">
                  Browse all
                </Link>
              </div>
            </>
          ) : (
            <p className="muted small">
              Connect JoyID from the header to issue a credential or to see the
              credentials indexed to your address. Verification works without a
              wallet.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <div className="card-title">
          <h2>Who does what</h2>
        </div>
        <div className="grid-2">
          {ROLES.map((entry) => (
            <div key={entry.role} className="step">
              <h3>{entry.role}</h3>
              <p className="muted small">{entry.body}</p>
              <Link className="btn btn-sm" to={entry.to}>
                {entry.cta}
              </Link>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="card-title">
          <h2>How it works</h2>
        </div>
        <div className="grid-2">
          {STEPS.map((step) => (
            <div key={step.title} className="step">
              <h3>{step.title}</h3>
              <p className="muted small">{step.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {health && !health.chain.reachable ? (
        <div style={{ marginTop: 18 }}>
          <Alert kind="warning" title="CKB node unreachable">
            Verification cannot be answered right now. The index still serves
            cached rows, but no credential can be confirmed until the RPC node
            responds.
          </Alert>
        </div>
      ) : null}

      <p className="muted small" style={{ marginTop: 24 }}>
        Running on <strong>{NETWORK}</strong>.{" "}
        <Link to="/verify">Verify a Spore id</Link> to see what the chain says,
        independently of any database row.
      </p>
    </>
  );
}

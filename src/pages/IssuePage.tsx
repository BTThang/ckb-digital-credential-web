import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import CopyButton from "@/components/CopyButton";
import { Alert, Card } from "@/components/ui";
import { NETWORK } from "@/config";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletProvider";
import { issueCredential } from "@/services/credentials";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_ISSUER_NAME_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/services/credentials/validation";
import {
  CREDENTIAL_TYPES,
  ISSUER_TYPES,
  type CredentialType,
  type IssuerType,
  type OrganizationType,
} from "@/types";
import { txExplorerUrl } from "@/utils/explorer";
import { humanizeToken, todayIso } from "@/utils/format";
import { isCkbAddress } from "@/utils/validation";

type Phase =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "broadcast"; txHash: string; sporeId: string }
  | { kind: "error"; message: string };

/**
 * How a self-declared organization type maps onto the issuer type stored in the
 * Spore cell.
 *
 * The two taxonomies are not the same list. `training_center` reads as a
 * school, and `nonprofit` has no on-chain counterpart at all - both fall back
 * to `OTHER` rather than being forced into a bucket that would be wrong on
 * chain, where anyone can read it.
 */
const ISSUER_TYPE_FOR_ORGANIZATION: Record<OrganizationType, IssuerType> = {
  company: "COMPANY",
  school: "SCHOOL",
  training_center: "SCHOOL",
  event_organizer: "EVENT_ORGANIZER",
  professional_organization: "PROFESSIONAL_ORGANIZATION",
  nonprofit: "OTHER",
  other: "OTHER",
};

/** Issuer name suggested by the signed-in profile, if it has one. */
function suggestedIssuerName(user: {
  displayName: string | null;
  organizationName: string | null;
}): string {
  return (user.organizationName ?? user.displayName ?? "").slice(
    0,
    MAX_ISSUER_NAME_LENGTH,
  );
}

export default function IssuePage() {
  const navigate = useNavigate();
  const { signer, address } = useWallet();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [issuerType, setIssuerType] = useState<IssuerType>("COMPANY");
  const [credentialType, setCredentialType] =
    useState<CredentialType>("COURSE_COMPLETION");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [expirationDate, setExpirationDate] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [indexNote, setIndexNote] = useState<string | null>(null);

  // Editing either field takes it out of the profile's hands for good: the
  // profile is a suggestion, never something that silently rewrites what the
  // user already typed.
  const [issuerNameEdited, setIssuerNameEdited] = useState(false);
  const [issuerTypeEdited, setIssuerTypeEdited] = useState(false);
  const [seededFor, setSeededFor] = useState<number | null>(null);

  const suggestion = user ? suggestedIssuerName(user) : "";
  const suggestedType = user?.organizationType
    ? ISSUER_TYPE_FOR_ORGANIZATION[user.organizationType]
    : null;

  // The session arrives after the first render, so the form is seeded once the
  // user is known. Adjusting state during render is deliberate here: doing it
  // in an effect would let a submission slip through with the old values.
  if (user && seededFor !== user.id) {
    setSeededFor(user.id);
    if (!issuerNameEdited && suggestion) setIssuerName(suggestion);
    if (!issuerTypeEdited && suggestedType) setIssuerType(suggestedType);
  }

  const issuerPrefilled = Boolean(user && !issuerNameEdited && suggestion);

  const recipientInput = recipient.trim() || address || "";
  const recipientValid = isCkbAddress(recipientInput);
  const busy = phase.kind === "signing";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!signer) return;

    setPhase({ kind: "signing" });
    setIndexNote(null);

    try {
      const result = await issueCredential({
        signer,
        issuerAddress: address ?? "",
        title,
        description,
        issuerName,
        issuerType,
        credentialType,
        issueDate,
        expirationDate,
        recipientAddress: recipientInput,
      });

      setPhase({
        kind: "broadcast",
        txHash: result.txHash,
        sporeId: result.sporeId,
      });

      if (result.credentialId) {
        navigate(`/credentials/${result.credentialId}`);
        return;
      }

      // The chain is already authoritative at this point; the index row only
      // makes the credential findable in the UI, so a failure here is a
      // non-fatal note rather than an error.
      setIndexNote(result.indexError);
    } catch (cause) {
      setPhase({
        kind: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "The wallet rejected the transaction.",
      });
    }
  }

  if (phase.kind === "broadcast") {
    return (
      <>
        <div className="page-header">
          <h1>Credential issued</h1>
          <p>
            The Spore cell is on its way to the chain. Ownership starts as soon
            as the transaction is committed.
          </p>
        </div>

        <Card>
          <Alert kind="success" title="Transaction submitted">
            Signed and broadcast as <code>{phase.txHash.slice(0, 18)}…</code>.
            The credential becomes verifiable once the node commits it.
          </Alert>

          <div style={{ marginTop: 16 }}>
            <dl className="dl">
              <dt>Spore id</dt>
              <dd className="break">
                <code>{phase.sporeId}</code> <CopyButton value={phase.sporeId} />
              </dd>
              <dt>Transaction</dt>
              <dd className="break">
                <a
                  href={txExplorerUrl(phase.txHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {phase.txHash}
                </a>{" "}
                <CopyButton value={phase.txHash} />
              </dd>
            </dl>
          </div>

          {indexNote ? (
            <div style={{ marginTop: 16 }}>
              <Alert kind="warning" title="Not indexed yet">
                {indexNote} The credential is still real — verify it by Spore id
                from the <Link to="/verify">Verify</Link> page.
              </Alert>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 18 }}>
            <Link
              className="btn btn-primary btn-sm"
              to={`/verify?sporeId=${encodeURIComponent(phase.sporeId)}`}
            >
              Verify on chain
            </Link>
            <Link className="btn btn-sm" to="/transactions">
              Track transaction
            </Link>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setPhase({ kind: "idle" });
                setTitle("");
                setDescription("");
                setRecipient("");
                setExpirationDate("");
                // The issuer is the same for every credential this account
                // signs, so it goes back to the profile suggestion rather than
                // to an empty field.
                setIssuerName(suggestion);
                setIssuerNameEdited(false);
                if (suggestedType) {
                  setIssuerType(suggestedType);
                  setIssuerTypeEdited(false);
                }
              }}
            >
              Issue another
            </button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Issue a credential</h1>
        <p>
          The payload below is written into a Spore cell owned by the recipient.
          Your wallet signs the transaction; no key ever touches this app's
          server.
        </p>
      </div>

      {!signer ? (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="info" title="Connect a wallet first">
            Issuing needs a signer. Use “Connect JoyID” or “Other wallets” in the
            header.
          </Alert>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="error" title="Could not issue">
            {phase.message}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="stack">
          <Card>
            <div className="card-title">
              <h2>Credential</h2>
            </div>

            <div className="stack">
              <div className="field">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  value={title}
                  maxLength={MAX_TITLE_LENGTH}
                  required
                  disabled={busy}
                  placeholder="Foundations of Distributed Systems"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  disabled={busy}
                  placeholder="What was achieved and what it entitles the holder to."
                  onChange={(event) => setDescription(event.target.value)}
                />
                <span className="hint">
                  {description.length}/{MAX_DESCRIPTION_LENGTH} characters
                </span>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label htmlFor="credential-type">Type *</label>
                  <select
                    id="credential-type"
                    value={credentialType}
                    disabled={busy}
                    onChange={(event) =>
                      setCredentialType(event.target.value as CredentialType)
                    }
                  >
                    {CREDENTIAL_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {humanizeToken(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="issuer-type">Issuer type *</label>
                  <select
                    id="issuer-type"
                    value={issuerType}
                    disabled={busy}
                    onChange={(event) => {
                      setIssuerType(event.target.value as IssuerType);
                      setIssuerTypeEdited(true);
                    }}
                  >
                    {ISSUER_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {humanizeToken(value)}
                      </option>
                    ))}
                  </select>
                  {suggestedType && !issuerTypeEdited ? (
                    <span className="hint">
                      Prefilled from your profile's organization type.
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-title">
              <h2>Issuer & validity</h2>
            </div>

            <div className="stack">
              <div className="field">
                <label htmlFor="issuer-name">Issuer name *</label>
                <input
                  id="issuer-name"
                  value={issuerName}
                  maxLength={MAX_ISSUER_NAME_LENGTH}
                  required
                  disabled={busy}
                  placeholder="Nervos Academy"
                  onChange={(event) => {
                    setIssuerName(event.target.value);
                    setIssuerNameEdited(true);
                  }}
                />
                <span className="hint">
                  {issuerPrefilled ? (
                    <>
                      Prefilled from your profile. Stored on chain, so anyone can
                      read who vouched for it - edit it if this credential comes
                      from someone else.{" "}
                      <Link to="/profile">Edit profile</Link>
                    </>
                  ) : (
                    "Stored on chain, so anyone can read who vouched for it."
                  )}
                </span>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label htmlFor="issue-date">Issue date *</label>
                  <input
                    id="issue-date"
                    type="date"
                    value={issueDate}
                    required
                    disabled={busy}
                    onChange={(event) => setIssueDate(event.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="expiration-date">Expiration date</label>
                  <input
                    id="expiration-date"
                    type="date"
                    value={expirationDate}
                    min={issueDate}
                    disabled={busy}
                    onChange={(event) => setExpirationDate(event.target.value)}
                  />
                  <span className="hint">Leave empty to never expire.</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-title">
              <h2>Owner</h2>
            </div>

            <div className="field">
              <label htmlFor="recipient">Recipient address</label>
              <input
                id="recipient"
                value={recipient}
                disabled={busy}
                placeholder={address ?? "ckt1…"}
                onChange={(event) => setRecipient(event.target.value)}
              />
              <span className="hint">
                {recipientInput
                  ? recipientValid
                    ? "The Spore lock script will be set to this address."
                    : "That is not a valid CKB address."
                  : `Empty means your own address (${address ?? "connect a wallet"}).`}
              </span>
            </div>
          </Card>

          <div className="row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!signer || busy}
            >
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Waiting for
                  wallet…
                </>
              ) : (
                `Issue on ${NETWORK}`
              )}
            </button>
            <span className="muted small">
              Your wallet will ask you to approve the transaction.
            </span>
          </div>
        </div>
      </form>
    </>
  );
}

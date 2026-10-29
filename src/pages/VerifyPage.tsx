import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CopyButton from "@/components/CopyButton";
import DidProfileCard from "@/components/DidProfileCard";
import { Alert, Card, Hash, Spinner, StatusBadge } from "@/components/ui";
import { useWallet } from "@/context/WalletProvider";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";
import { fetchDidProfiles } from "@/services/ckb/did-profile";
import type {
  CoreVerificationResult,
  IssuerEvidence,
  OwnershipVerification,
  SporeVerification,
  VerificationEvidenceSummary,
} from "@/types";
import { addressExplorerUrl, txExplorerUrl } from "@/utils/explorer";
import { formatDate, formatDateTime, humanizeToken } from "@/utils/format";
import {
  isCkbAddress,
  isCkbPopId,
  isDidCkb,
  isSporeId,
  normalizeCkbPopId,
  normalizeDidCkb,
  normalizeSporeId,
} from "@/utils/validation";

/**
 * Families come from `GET /api/verify/families`, so the selector is not tied
 * to the list this build was compiled with. The display metadata below still
 * gives the families we know today their tailored input UX; a newly discovered
 * family falls back to a generic label and is validated by the backend.
 */
interface FamilyOption {
  family: string;
  description: string;
}

interface FamilyDisplay {
  label: string;
  placeholder: string;
  hint: string;
}

/**
 * Where the expected owner came from.
 *
 * This is the minimum state needed to keep a wallet-derived owner honest: a
 * wallet-derived address follows the wallet, while an address the user typed
 * is never overwritten by wallet state.
 */
type OwnerSource = "manual" | "wallet";

const KNOWN_FAMILY_DISPLAY: Record<string, FamilyDisplay> = {
  spore: {
    label: "Spore id",
    placeholder: "0x… (32 bytes)",
    hint: "A Spore id is 32 bytes of hex — the cell's type script args.",
  },
  "vellum-claim": {
    label: "did:ckb identifier",
    placeholder: "did:ckb:…",
    hint: "A Vellum claim is a did:ckb identifier, resolved to its live DID Metadata Cell.",
  },
  "ckb-pop": {
    label: "CKB-PoP identifier",
    placeholder: "0x + 120 hex",
    hint: "A CKB-PoP badge identifier is the dob-badge type script args (0x + 120 hex).",
  },
};

const FALLBACK_FAMILIES: FamilyOption[] = [
  { family: "spore", description: "Spore credentials" },
  { family: "vellum-claim", description: "Vellum claims" },
  { family: "ckb-pop", description: "CKB proof-of-personhood badges" },
];

function familyDisplay(family: string): FamilyDisplay {
  return (
    KNOWN_FAMILY_DISPLAY[family] ?? {
      label: `${family} identifier`,
      placeholder: "Credential identifier",
      hint: `The identifier is read from the live chain by the ${family} verifier.`,
    }
  );
}

function isKnownFamily(family: string): boolean {
  return family === "spore" || family === "vellum-claim" || family === "ckb-pop";
}

function familyOptionLabel(family: string): string {
  if (family === "spore") return "Spore";
  if (family === "vellum-claim") return "Vellum claim (did:ckb)";
  if (family === "ckb-pop") return "CKB-PoP";
  return family;
}

function initialFamilyFrom(value: string | null): string {
  return value && value.trim().length > 0 ? value : "spore";
}

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

// Family-agnostic copy for CKB-PoP (normalized core states).
const CORE_STATE_COPY: Record<
  string,
  { kind: "success" | "error" | "warning"; title: string; body: string }
> = {
  valid: {
    kind: "success",
    title: "Verified on chain",
    body: "This credential exists and passes protocol validation.",
  },
  invalid: {
    kind: "error",
    title: "Invalid",
    body: "The credential exists but does not satisfy protocol rules.",
  },
  not_found: {
    kind: "error",
    title: "Not found",
    body: "No live credential with this identifier was found.",
  },
  unable_to_verify: {
    kind: "warning",
    title: "Unable to verify",
    body: "The CKB node/indexer could not be queried. Try again later.",
  },
  unsupported: {
    kind: "warning",
    title: "Unsupported",
    body: "This build cannot verify this credential family on the configured network.",
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
/**
 * Issuer evidence for a verified credential.
 *
 * The point of separating this card from the verdict: a credential can be
 * perfectly valid on chain while naming an issuer it cannot prove. Only
 * `verified` means the signing key is provably bound to the address, so the
 * card states that plainly instead of implying trust.
 */
function IssuerEvidenceCard({ issuer }: { issuer: IssuerEvidence }) {
  const proven = issuer.verified;

  return (
    <Card>
      <div className="card-title">
        <h3>Issuer evidence</h3>
        <StatusBadge value={proven ? "verified" : "unverified"} />
      </div>
      <Alert
        kind={proven ? "success" : "warning"}
        title={proven ? "Issuer address is proven" : "Issuer is claimed, not proven"}
      >
        {proven
          ? "The credential carries a proof whose signing key is provably bound to the issuer address below."
          : "This credential does not carry a checkable issuer proof. The name below is self-asserted metadata and must not be treated as an authenticated identity."}
      </Alert>
      <dl className="dl" style={{ marginTop: 16 }}>
        <dt>Issuer name</dt>
        <dd>{issuer.name ?? "—"}</dd>
        <dt>Issuer type</dt>
        <dd>{issuer.type ? humanizeToken(issuer.type) : "—"}</dd>
        <dt>Issuer address</dt>
        <dd className="break">
          {issuer.address ? (
            <a
              href={addressExplorerUrl(issuer.address)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {issuer.address}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>Proof status</dt>
        <dd>{humanizeToken(issuer.proofStatus)}</dd>
      </dl>
    </Card>
  );
}

/**
 * The current-owner check.
 *
 * `matches` is computed by the backend from the live cell's lock, never from
 * the value the verifier typed here - so a mismatch is a real fact about the
 * credential, not a client-side guess.
 */
function OwnershipCard({
  ownership,
  source,
}: {
  ownership: OwnershipVerification;
  source: OwnerSource | null;
}) {
  const checked = Boolean(ownership.chainOwner);

  return (
    <Card>
      <div className="card-title">
        <h3>Current-owner check</h3>
        <StatusBadge value={ownership.matches ? "verified" : "mismatch"} />
      </div>
      <Alert
        kind={ownership.matches ? "success" : checked ? "error" : "warning"}
        title={
          ownership.matches
            ? "Held by the expected owner"
            : checked
              ? "Held by a different address"
              : "Ownership could not be confirmed"
        }
      >
        {ownership.matches
          ? "The credential's live cell is locked to the address you expected."
          : (ownership.reason ??
            "The expected owner does not match the credential's current owner.")}
      </Alert>
      <dl className="dl" style={{ marginTop: 16 }}>
        <dt>Expected owner</dt>
        <dd className="break mono">{ownership.expectedOwner}</dd>
        <dt>Chain owner</dt>
        <dd className="break mono">
          {ownership.chainOwner ? (
            <a
              href={addressExplorerUrl(ownership.chainOwner)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {ownership.chainOwner}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>Checked at</dt>
        <dd>{formatDateTime(ownership.checkedAt)}</dd>
      </dl>
      {source === "wallet" ? (
        <p className="muted small" style={{ marginTop: 8 }}>
          The expected owner is the address of your connected wallet.
        </p>
      ) : null}
      <p className="muted small" style={{ marginTop: 8 }}>
        Ownership is a separate fact from the verification result: a different
        holder does not make the credential invalid, and a matching holder does
        not make it valid.
      </p>
    </Card>
  );
}
/**
 * Phase 9 - the family-neutral chain facts behind a verdict.
 *
 * The card exists so a reader can see the identifier/network/owner/outpoint
 * that supported the result without decoding family-specific evidence. It does
 * not replace that evidence, which remains under the result's details.
 */
function EvidenceSummaryCard({
  summary,
}: {
  summary: VerificationEvidenceSummary;
}) {
  return (
    <Card>
      <div className="card-title">
        <h3>Evidence summary</h3>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        These facts were reported by the {summary.family ?? "routed"} verifier
        from chain state. The family-specific evidence remains the authoritative
        detail.
      </p>
      <dl className="dl">
        <dt>Network</dt>
        <dd>{summary.network ?? "—"}</dd>
        <dt>On-chain owner</dt>
        <dd className="break mono">
          {summary.owner ? (
            <a
              href={addressExplorerUrl(summary.owner)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {summary.owner}
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>Outpoint</dt>
        <dd className="break mono">
          {summary.outPoint
            ? `${summary.outPoint.txHash}${summary.outPoint.index !== null ? `#${summary.outPoint.index}` : ""}`
            : "—"}
        </dd>
        <dt>Checked at</dt>
        <dd>{formatDateTime(summary.checkedAt)}</dd>
      </dl>
    </Card>
  );
}

export default function VerifyPage() {
  const [params, setParams] = useSearchParams();
  // `sporeId` is the original query key; `id` is what this page writes for
  // every other family. Reading both keeps a pasted/shareable URL working
  // after a reload, including for a family discovered from the API.
  const initialId = params.get("sporeId") ?? params.get("id") ?? "";
  const [family, setFamily] = useState<string>(() =>
    initialFamilyFrom(params.get("family")),
  );
  const [input, setInput] = useState(initialId);
  const [submitted, setSubmitted] = useState(initialId);
  const [ownerInput, setOwnerInput] = useState("");
  const [ownerSource, setOwnerSource] = useState<OwnerSource | null>(null);

  // Family discovery is additive: the API decides what is routable, while a
  // failed or absent discovery call falls back to the built-in list so offline
  // builds and tests keep working. Spore stays the default either way.
  const familyDiscovery = useAsync(
    async (): Promise<FamilyOption[]> => {
      if (typeof api.listFamilies !== "function") return FALLBACK_FAMILIES;
      try {
        const discovered = await api.listFamilies();
        if (discovered.length === 0) return FALLBACK_FAMILIES;
        return discovered.map((entry) => ({
          family: String(entry.family),
          description: entry.description,
        }));
      } catch {
        return FALLBACK_FAMILIES;
      }
    },
    [],
  );
  const discoveredFamilies = familyDiscovery.data ?? FALLBACK_FAMILIES;
  // A family named in the URL must still have a matching option even if the
  // discovery response does not mention it; the backend will answer for it.
  const familyOptions = discoveredFamilies.some(
    (entry) => entry.family === family,
  )
    ? discoveredFamilies
    : [...discoveredFamilies, { family, description: "" }];
  const currentFamily = familyDisplay(family);

  // The connected wallet is the source of truth for a wallet-derived owner.
  // The address is the signer's own address (`getInternalAddress`), never a
  // recommended address, because only the signer can say which lock it holds.
  const { address: walletAddress, restoring: walletRestoring } = useWallet();

  // A wallet address is only useful if it is a real CKB address; anything else
  // must never reach the field, because an invalid owner disables the whole
  // verification.
  const connectedAddress =
    walletAddress && isCkbAddress(walletAddress) ? walletAddress : null;

  // A wallet-derived owner follows the wallet: switching wallets must not leave
  // a stale address behind, and a disconnect must not leave an address that no
  // longer belongs to anyone. A manually typed owner is never touched by the
  // wallet - it is derived, not synchronised, so nothing has to be written back.
  const expectedOwner = ownerSource === "wallet" ? (connectedAddress ?? "") : ownerInput;

  const normalizedSpore = normalizeSporeId(submitted);
  const normalizedCkbPop = normalizeCkbPopId(submitted);
  const normalizedDid = normalizeDidCkb(submitted);
  const validSpore = family === "spore" && isSporeId(normalizedSpore);
  const validCkbPop = family === "ckb-pop" && isCkbPopId(normalizedCkbPop);
  const validDid = family === "vellum-claim" && isDidCkb(normalizedDid);
  // A discovered family without a client-side rule is still allowed through:
  // the core owns identifier validation per family, so the UI must not reject
  // an identifier merely because it predates this build.
  const validDiscovered =
    !isKnownFamily(family) && submitted.trim().length > 0;

  const ownerValue = expectedOwner.trim();
  const ownerProvided = ownerValue.length > 0;
  const ownerValid = !ownerProvided || isCkbAddress(ownerValue);

  // The core runs for the two families that have no Phase 1 endpoint, and for
  // Spore too - that is where the issuer evidence and the owner check live.
  const coreIdentifier =
    family === "vellum-claim"
      ? normalizedDid
      : family === "ckb-pop"
        ? normalizedCkbPop
        : family === "spore"
          ? normalizedSpore
          : submitted.trim();
  const coreEnabled =
    (validSpore || validDid || validCkbPop || validDiscovered) && ownerValid;

  const report = useAsync(
    () => api.verifySporeId(normalizedSpore),
    [normalizedSpore],
    { enabled: validSpore },
  );

  const core = useAsync(
    () =>
      api.verify({
        identifier: coreIdentifier,
        family,
        ...(ownerProvided && ownerValid ? { expectedOwner: ownerValue } : {}),
      }),
    [coreIdentifier, family, ownerProvided, ownerValid, ownerValue],
    { enabled: coreEnabled },
  );

  const lookup = useAsync(
    () => api.lookupSpore(normalizedSpore),
    [normalizedSpore],
    { enabled: validSpore },
  );

  // The public DID profile of the connected address. It is decoration only: it
  // is read in its own request, it never reaches the verification API and it
  // cannot change a verdict.
  const didProfiles = useAsync(
    () => fetchDidProfiles(connectedAddress ?? ""),
    [connectedAddress],
    { enabled: Boolean(connectedAddress) },
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    setSubmitted(value);
    const q: Record<string, string> = {};
    if (value) q[family === "spore" ? "sporeId" : "id"] = value;
    if (family !== "spore") q.family = family;
    setParams(q, { replace: true });
  }

  function handleOwnerInput(value: string) {
    setOwnerInput(value);
    // Typing takes the field back from the wallet: from here on the wallet
    // must not overwrite what the user wrote.
    setOwnerSource("manual");
  }

  function handleUseConnectedWallet() {
    if (!connectedAddress) return;
    setOwnerSource("wallet");
  }

  const state = validSpore ? report.data?.state : undefined;
  const copySpore = state ? STATE_COPY[state] : undefined;
  const coreRes: CoreVerificationResult | null =
    coreEnabled ? core.data : null;
  const copyCore = coreRes ? CORE_STATE_COPY[coreRes.state] : undefined;

  return (
    <>
      <div className="page-header">
        <h1>Verify a credential</h1>
        <p>
          Paste a credential identifier to verify it on CKB. Everything below is
          read from the live chain — no account and no index is required.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="stack-sm">
          <div className="field">
            <label htmlFor="family">Credential family</label>
            <select
              id="family"
              value={family}
              onChange={(event) => {
                setFamily(event.target.value);
                setSubmitted("");
                setInput("");
                setParams({}, { replace: true });
              }}
            >
              {familyOptions.map((option) => (
                <option key={option.family} value={option.family}>
                  {familyOptionLabel(option.family)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="spore-id">{currentFamily.label}</label>
            <input
              id="spore-id"
              className="mono"
              value={input}
              spellCheck={false}
              placeholder={currentFamily.placeholder}
              onChange={(event) => setInput(event.target.value)}
            />
            <span className="hint">{currentFamily.hint}</span>
          </div>
          <div className="field">
            <label htmlFor="expected-owner">
              Expected owner address <span className="muted small">(optional)</span>
            </label>
            <input
              id="expected-owner"
              className="mono"
              value={expectedOwner}
              spellCheck={false}
              placeholder="ckt1…"
              onChange={(event) => handleOwnerInput(event.target.value)}
            />
            <div className="row">
              {connectedAddress ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleUseConnectedWallet}
                  >
                    Use connected wallet
                  </button>
                  <span className="muted small">
                    Connected: <Hash value={connectedAddress} />
                  </span>
                </>
              ) : walletAddress ? (
                <span className="muted small">
                  The connected wallet did not report a usable CKB address.
                </span>
              ) : (
                <span className="muted small">
                  {walletRestoring
                    ? "Restoring wallet…"
                    : "Connect a wallet to fill this from your own address."}
                </span>
              )}
              {ownerSource === "wallet" ? (
                <span className="muted small">
                  {connectedAddress
                    ? "Filled from your connected wallet"
                    : "Waiting for a connected wallet"}
                </span>
              ) : null}
            </div>
            <span className="hint">
              Supply an address to also ask “does this credential belong to this
              holder?”. The owner is still read from the chain; this only becomes
              the comparison.
            </span>
          </div>
          {connectedAddress && didProfiles.loading ? (
            <p className="muted small" style={{ margin: 0 }}>
              Reading the public profile published on chain…
            </p>
          ) : null}
          {connectedAddress && didProfiles.data?.length ? (
            <DidProfileCard profiles={didProfiles.data} />
          ) : null}
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

      {ownerProvided && !ownerValid ? (
        <div style={{ marginTop: 18 }}>
          <Alert kind="error" title="That is not a CKB address">
            An expected owner must be a <code>ckb1…</code> or <code>ckt1…</code>{" "}
            bech32 address. Clear the field to verify without an owner check.
          </Alert>
        </div>
      ) : null}

      {submitted && family === "spore" && !validSpore ? (
        <div style={{ marginTop: 18 }}>
          <Alert kind="error" title="That is not a Spore id">
            A Spore id is <code>0x</code> followed by 64 hex characters. The
            issuing screen shows the id for every credential it creates.
          </Alert>
        </div>
      ) : null}

      {submitted && family === "vellum-claim" && !validDid ? (
        <div style={{ marginTop: 18 }}>
          <Alert kind="error" title="That is not a did:ckb identifier">
            A Vellum claim identifier looks like{" "}
            <code>did:ckb:</code> followed by 32 bech32 characters.
          </Alert>
        </div>
      ) : null}

      {submitted && family === "ckb-pop" && !validCkbPop ? (
        <div style={{ marginTop: 18 }}>
          <Alert kind="error" title="That is not a CKB-PoP identifier">
            A CKB-PoP badge identifier is <code>0x</code> followed by exactly 120
            hex characters (60 bytes), per the protocol.
          </Alert>
        </div>
      ) : null}

      {validSpore ? (
        <div style={{ marginTop: 18 }}>
          {report.loading ? <Spinner label="Reading the live cell…" /> : null}

          {report.error ? (
            <Alert kind="error" title="Verification failed">
              {report.error}
            </Alert>
          ) : null}

          {report.data && copySpore ? (
            <div className="stack">
              <Card>
                <div className="card-title">
                  <h2>Result</h2>
                  <StatusBadge value={report.data.state} />
                </div>
                <Alert kind={copySpore.kind} title={copySpore.title}>
                  {copySpore.body}
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

      {family !== "spore" && (validCkbPop || validDid || validDiscovered) ? (
        <div style={{ marginTop: 18 }}>
          {core.loading ? (
            <Spinner label={`Verifying ${family}…`} />
          ) : null}

          {core.error ? (
            <Alert kind="error" title="Verification failed">
              {core.error}
            </Alert>
          ) : null}

          {coreRes && copyCore ? (
            <div className="stack">
              <Card>
                <div className="card-title">
                  <h2>Result</h2>
                  <StatusBadge value={coreRes.state} />
                </div>
                <Alert kind={copyCore.kind} title={copyCore.title}>
                  {copyCore.body}
                </Alert>
                {coreRes.reason ? (
                  <p className="muted" style={{ marginTop: 12 }}>
                    {coreRes.reason}
                  </p>
                ) : null}
                <dl className="dl" style={{ marginTop: 16 }}>
                  <dt>Identifier</dt>
                  <dd className="break mono">{coreRes.identifier}</dd>
                  <dt>Family</dt>
                  <dd>{coreRes.family ?? "—"}</dd>
                  <dt>Checked at</dt>
                  <dd>{formatDateTime(coreRes.checkedAt)}</dd>
                  <dt>Routed</dt>
                  <dd>{coreRes.routed ? "yes" : "no"}</dd>
                  <dt>Supported</dt>
                  <dd>{coreRes.supported ? "yes" : "no"}</dd>
                </dl>
                {coreRes.result?.evidence &&
                typeof coreRes.result.evidence === "object" ? (
                  <div style={{ marginTop: 16 }}>
                    <details>
                      <summary>Evidence</summary>
                      <pre
                        className="mono"
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          marginTop: 8,
                        }}
                      >
                        {JSON.stringify(coreRes.result.evidence, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : null}
              </Card>

              {coreRes.evidenceSummary ? (
                <EvidenceSummaryCard summary={coreRes.evidenceSummary} />
              ) : null}
              {coreRes.issuer ? (
                <IssuerEvidenceCard issuer={coreRes.issuer} />
              ) : null}
              {coreRes.ownership ? (
                <OwnershipCard
                  ownership={coreRes.ownership}
                  source={ownerSource}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Spore keeps its rich Phase 1 report above; the core supplies the
          Phase 5 issuer/ownership cards whenever it ran. */}
      {validSpore && coreEnabled ? (
        <div style={{ marginTop: 18 }} className="stack">
          {coreRes?.evidenceSummary ? (
            <EvidenceSummaryCard summary={coreRes.evidenceSummary} />
          ) : null}
          {coreRes?.issuer ? (
            <IssuerEvidenceCard issuer={coreRes.issuer} />
          ) : null}
          {coreRes?.ownership ? (
            <OwnershipCard
              ownership={coreRes.ownership}
              source={ownerSource}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

import { Link } from "react-router-dom";

import ShareQrButton from "@/components/ShareQrButton";
import { Hash, StatusBadge } from "@/components/ui";
import { useWallet } from "@/context/WalletProvider";
import type { Credential } from "@/types";
import { addressExplorerUrl, txExplorerUrl } from "@/utils/explorer";
import { formatDate, humanizeToken, isExpired, shortAddress } from "@/utils/format";

/** One credential in a list. Only cached fields are shown; state is a hint. */
export default function CredentialCard({
  credential,
}: {
  credential: Credential;
}) {
  const { address } = useWallet();
  const expired = isExpired(credential.expirationDate);
  const owned = Boolean(address && credential.ownerAddress === address);

  return (
    <article className="card card-hover credential-card">
      <h3 className="credential-card-title">
        <Link to={`/credentials/${credential.id}`}>{credential.title}</Link>
      </h3>

      <div className="credential-card-meta">
        <StatusBadge value={credential.status} />
        {owned ? <span className="badge badge-verified">yours</span> : null}
        {expired ? <span className="badge badge-failed">expired</span> : null}
      </div>

      {credential.description ? (
        <p className="muted small">{credential.description}</p>
      ) : null}

      <div className="credential-card-foot">
        <span title={credential.issuerName}>
          {credential.issuerName} · {humanizeToken(credential.credentialType)}
        </span>
        <span title={`Spore id ${credential.sporeId}`}>
          <Hash value={credential.sporeId} />
        </span>
      </div>

      <div className="row small muted" style={{ marginTop: 8 }}>
        <span title={credential.ownerAddress}>
          owner {shortAddress(credential.ownerAddress)}
        </span>
        <span>·</span>
        <a
          href={addressExplorerUrl(credential.ownerAddress)}
          target="_blank"
          rel="noreferrer noopener"
        >
          explorer
        </a>
        <span>·</span>
        <span>issued {formatDate(credential.issueDate)}</span>
        <span>·</span>
        <a
          href={txExplorerUrl(credential.creationTxHash)}
          target="_blank"
          rel="noreferrer noopener"
        >
          creation tx
        </a>
      </div>

      {/* Holder- and issuer-facing actions: anyone can present a credential. */}
      <div className="row" style={{ marginTop: 10 }}>
        <Link className="btn btn-sm" to={`/verify/${credential.sporeId}`}>
          Verify
        </Link>
        <ShareQrButton sporeId={credential.sporeId} label="Share" />
      </div>
    </article>
  );
}

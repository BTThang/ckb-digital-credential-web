import { Link } from "react-router-dom";

import CredentialCard from "@/components/CredentialCard";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthProvider";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";

const PAGE_SIZE = 12;

/**
 * Credentials held by the signed-in user's wallet.
 *
 * The filter is the session's own wallet address, not a connected-wallet
 * address: the point of this page is "what belongs to the account I signed in
 * as", which survives switching wallets in the header.
 */
export default function MyCredentialsPage() {
  const { user } = useAuth();
  const owner = user?.walletAddress;

  const credentials = useAsync(
    () =>
      owner
        ? api.listCredentials({ owner, limit: PAGE_SIZE })
        : Promise.resolve({ data: [], total: 0 }),
    [owner],
  );

  const items = credentials.data?.data ?? [];

  if (!owner) return <Spinner label="Loading your credentials…" />;

  return (
    <>
      <div className="page-header">
        <h1>My credentials</h1>
        <p>
          <strong>Holder</strong> view: indexed rows owned by{" "}
          <code className="break">{owner}</code>. You can present any of them —
          <em>Verify</em> opens the public page and <em>Share</em> shows a QR
          code. Ownership itself is read from the chain, not from this list.
        </p>
      </div>

      {credentials.error ? (
        <Alert kind="error" title="Could not load your credentials">
          {credentials.error}
        </Alert>
      ) : null}

      {credentials.loading && items.length === 0 ? (
        <Spinner label="Loading your credentials…" />
      ) : null}

      {!credentials.loading && !credentials.error && items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          icon="◍"
          action={
            <Link className="btn btn-primary btn-sm" to="/issue">
              Issue a credential
            </Link>
          }
        >
          This wallet does not hold any indexed credentials.
        </EmptyState>
      ) : null}

      {items.length > 0 ? (
        <div className="grid">
          {items.map((credential) => (
            <CredentialCard key={credential.id} credential={credential} />
          ))}
        </div>
      ) : null}
    </>
  );
}

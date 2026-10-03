import { Link } from "react-router-dom";

import CredentialCard from "@/components/CredentialCard";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthProvider";
import { useAsync } from "@/hooks";
import { api } from "@/services/api";

const PAGE_SIZE = 12;

/**
 * Credentials this account issued, filtered by the session's wallet address as
 * the issuer - the mirror image of My Credentials, which filters by owner.
 */
export default function IssuedCredentialsPage() {
  const { user } = useAuth();
  const issuer = user?.walletAddress;

  const credentials = useAsync(
    () =>
      issuer
        ? api.listCredentials({ issuer, limit: PAGE_SIZE })
        : Promise.resolve({ data: [], total: 0 }),
    [issuer],
  );

  const items = credentials.data?.data ?? [];

  if (!issuer) return <Spinner label="Loading your issued credentials…" />;

  return (
    <>
      <div className="page-header">
        <h1>Issued credentials</h1>
        <p>
          Indexed credentials whose issuer is{" "}
          <code className="break">{issuer}</code>. An issuer record is an
          off-chain claim - verify a credential to confirm who really holds it.
        </p>
      </div>

      {credentials.error ? (
        <Alert kind="error" title="Could not load your issued credentials">
          {credentials.error}
        </Alert>
      ) : null}

      {credentials.loading && items.length === 0 ? (
        <Spinner label="Loading your issued credentials…" />
      ) : null}

      {!credentials.loading && !credentials.error && items.length === 0 ? (
        <EmptyState
          title="You have not issued anything yet"
          icon="◍"
          action={
            <Link className="btn btn-primary btn-sm" to="/issue">
              Issue a credential
            </Link>
          }
        >
          Credentials you issue will be listed here.
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

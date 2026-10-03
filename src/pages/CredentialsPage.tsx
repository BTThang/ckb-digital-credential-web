import { useState } from "react";
import { Link } from "react-router-dom";

import CredentialCard from "@/components/CredentialCard";
import { Alert, Card, EmptyState, Spinner } from "@/components/ui";
import { useWallet } from "@/context/WalletProvider";
import { useAsync, useDebounced } from "@/hooks";
import { api, type ListCredentialsQuery } from "@/services/api";
import {
  CREDENTIAL_STATUSES,
  CREDENTIAL_TYPES,
  type CredentialStatus,
  type CredentialType,
} from "@/types";
import { humanizeToken } from "@/utils/format";

const PAGE_SIZE = 12;

export default function CredentialsPage() {
  const { address } = useWallet();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CredentialStatus | "">("");
  const [type, setType] = useState<CredentialType | "">("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebounced(search);

  const query: ListCredentialsQuery = {
    search: debouncedSearch || undefined,
    status: status || undefined,
    type: type || undefined,
    // A wallet that is not connected cannot own anything, so the "mine only"
    // filter would show an empty page instead of everything.
    owner: onlyMine && address ? address : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const list = useAsync(() => api.listCredentials(query), [
    debouncedSearch,
    status,
    type,
    onlyMine,
    address,
    page,
  ]);

  const total = list.data?.total ?? 0;
  const items = list.data?.data ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function reset(next: () => void) {
    next();
    setPage(0);
  }

  return (
    <>
      <div className="page-header">
        <h1>Credentials</h1>
        <p>
          Rows come from the local index, which is a cache of the chain. Treat
          the status here as a hint and use{" "}
          <Link to="/verify">Verify</Link> when you need a chain-anchored answer.
        </p>
      </div>

      <div className="filters">
        <div className="field">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            type="search"
            placeholder="Title, issuer, spore id…"
            value={search}
            onChange={(event) => reset(() => setSearch(event.target.value))}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={status}
            onChange={(event) =>
              reset(() =>
                setStatus(event.target.value as CredentialStatus | ""),
              )
            }
          >
            <option value="">Any status</option>
            {CREDENTIAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-type">Type</label>
          <select
            id="filter-type"
            value={type}
            onChange={(event) =>
              reset(() => setType(event.target.value as CredentialType | ""))
            }
          >
            <option value="">Any type</option>
            {CREDENTIAL_TYPES.map((value) => (
              <option key={value} value={value}>
                {humanizeToken(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="field checkbox">
          <input
            id="filter-mine"
            type="checkbox"
            checked={onlyMine}
            disabled={!address}
            onChange={(event) => reset(() => setOnlyMine(event.target.checked))}
          />
          <label htmlFor="filter-mine">
            Only mine
            {address ? "" : " (connect a wallet)"}
          </label>
        </div>
      </div>

      {list.error ? (
        <Alert kind="error" title="Could not load credentials">
          {list.error}
        </Alert>
      ) : null}

      {list.loading && items.length === 0 ? (
        <Spinner label="Loading credentials…" />
      ) : null}

      {!list.loading && !list.error && items.length === 0 ? (
        <EmptyState
          title="No credentials match"
          icon="◍"
          action={
            <Link className="btn btn-primary btn-sm" to="/issue">
              Issue a credential
            </Link>
          }
        >
          {search || status || type
            ? "Try clearing the filters."
            : "Nothing has been indexed yet. Issue the first credential."}
        </EmptyState>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="grid">
            {items.map((credential) => (
              <CredentialCard key={credential.id} credential={credential} />
            ))}
          </div>

          {pageCount > 1 ? (
            <div className="pagination">
              <button
                type="button"
                className="btn btn-sm"
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous
              </button>
              <span className="small muted">
                Page {page + 1} of {pageCount} · {total} total
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <Card>
        <div className="spread">
          <div>
            <h3>Re-read the chain</h3>
            <p className="muted small" style={{ margin: 0 }}>
              Asks the indexer to re-read every row from CKB and reconcile
              owners and statuses with the live cells.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            disabled={list.loading}
            onClick={() => void api.syncCredentials().then(() => list.reload())}
          >
            Sync index
          </button>
        </div>
      </Card>
    </>
  );
}

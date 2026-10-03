import { ccc } from "@ckb-ccc/ccc";
import { Provider } from "@ckb-ccc/connector-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { NETWORK, WALLET_ICON, WALLET_NAME } from "@/config";
import { isCkbSigner } from "@/services/wallet";

/**
 * Bridges the app to CCC's connector.
 *
 * `useCcc` throws unless it is rendered inside this provider, and the provider
 * needs an already-open `ccc.Client`.
 *
 * The client is opened here rather than shared with `getCkbClient()` on
 * purpose: CCC disposes a borrowed client when the provider unmounts, which
 * React StrictMode does on every dev render. A dedicated client can be
 * discarded safely, whereas a shared one would be handed back to the rest of
 * the app already disposed.
 *
 * `signerFilter` limits the connector to CKB, because no other chain can hold a
 * Spore cell.
 */
export function ConnectorProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ccc.Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `ClientPublic*.open()` is synchronous and throws on an unreachable node.
    try {
      const owner =
        NETWORK === "mainnet"
          ? ccc.ClientPublicMainnet.open()
          : ccc.ClientPublicTestnet.open();
      setClient(owner.value);
      setError(null);
    } catch (cause) {
      setClient(null);
      // Reported explicitly rather than silently rendering a dead UI: the whole
      // app depends on being able to read the chain.
      setError(
        cause instanceof Error ? cause.message : "Could not reach a CKB node.",
      );
    }
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  if (error) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <section className="card">
            <h1>CKB node unreachable</h1>
            <p className="muted">
              This dApp reads Nervos CKB directly, so it cannot start until a
              node responds. {error}
            </p>
            <p className="muted small">
              Check that <code>{NETWORK}</code> is reachable, or point{" "}
              <code>VITE_CKB_RPC_URL</code> at a working node and reload.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={retry}
            >
              Retry
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <div className="loading-block" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>Connecting to CKB {NETWORK}…</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <Provider
      name={WALLET_NAME}
      icon={WALLET_ICON}
      signerFilter={isCkbSigner}
      defaultClient={client}
    >
      {children}
    </Provider>
  );
}

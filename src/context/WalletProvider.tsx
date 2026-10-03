import type { ccc } from "@ckb-ccc/ccc";
import { useCcc, useSigner } from "@ckb-ccc/connector-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getCkbClient } from "@/services/ckb/client";
import {
  connectJoyId,
  readSignerAddress,
  restoreJoyId,
} from "@/services/wallet";

export interface WalletState {
  /** Signer used for writes. Undefined while nothing is connected. */
  signer: ccc.Signer | undefined;
  address: string | null;
  /** Which integration produced the active signer, for display only. */
  source: "joyid" | "connector" | null;
  connecting: boolean;
  /** True while a reload-triggered JoyID session is being looked up. */
  restoring: boolean;
  error: string | null;
  /** Opens the CCC connector modal so any other CKB wallet can be picked. */
  openConnector: () => void;
  /** One-click JoyID sign-in. */
  connectJoyId: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return context;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // `signer` lives in its own hook; `useCcc` only exposes the modal and the
  // currently selected wallet.
  const { client, signerInfo, open, disconnect } = useCcc();
  const connectorSigner = useSigner();

  const [joyIdSigner, setJoyIdSigner] = useState<ccc.Signer | null>(null);
  const [joyIdAddress, setJoyIdAddress] = useState<string | null>(null);
  const [connectorAddress, setConnectorAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  // True from the first frame: a reload always triggers one storage read, so
  // "Restoring wallet…" is the honest starting state rather than a flash of
  // "Connect" for someone who is already connected.
  const [restoring, setRestoring] = useState(true);
  const [joyIdAutoRestored, setJoyIdAutoRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `ccc-connector` restores its own sessions, but the JoyID one-click path
  // bypasses that element and keeps the signer here, so a reload would silently
  // drop a wallet the user believes is still connected. JoyID caches the grant
  // in local storage, so re-adopting it costs one read and no popup.
  const restoreStarted = useRef(false);
  // An explicit disconnect wins over a restore that is still in flight.
  const joyIdRejected = useRef(false);
  // The restore outlives individual effect cleanups, so liveness is tracked for
  // the whole mount instead. Bailing out on cleanup would strand `restoring`
  // at `true` whenever an unrelated re-render interrupts the storage read.
  const mounted = useRef(true);
  useEffect(() => {
    // StrictMode mounts, unmounts and remounts every effect in development, so
    // the flag has to be re-armed on the way in. Without this the cleanup of
    // the discarded pass would latch it off and the restore could never report
    // back, leaving the header spinning forever.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (restoreStarted.current) return;

    // Captured up front so the async body cannot read newer values.
    const eligible = !joyIdRejected.current && !joyIdSigner && !connectorSigner;
    restoreStarted.current = true;

    void (async () => {
      try {
        if (!eligible) return;

        const restored = await restoreJoyId(client ?? (await getCkbClient()));
        if (mounted.current && !joyIdRejected.current && restored) {
          setJoyIdSigner(restored);
          setJoyIdAutoRestored(true);
          setJoyIdAddress(await readSignerAddress(restored));
        }
      } catch {
        // A failed lookup is indistinguishable from "not connected", so it must
        // not raise an error the user cannot act on.
      } finally {
        // Runs for the skipped path too, so the flag can never get stuck.
        if (mounted.current) setRestoring(false);
      }
    })();
  }, [client, connectorSigner, joyIdSigner]);

  // A connector wallet can hand over a new signer at any time; the address is
  // only reachable asynchronously, so mirror it into state.
  useEffect(() => {
    if (!connectorSigner) return;

    let cancelled = false;
    void readSignerAddress(connectorSigner).then((address) => {
      if (!cancelled) setConnectorAddress(address || null);
    });
    return () => {
      cancelled = true;
    };
  }, [connectorSigner, signerInfo]);

  const handleConnectJoyId = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const signer = await connectJoyId(client ?? (await getCkbClient()));
      setJoyIdSigner(signer);
      setJoyIdAutoRestored(false);
      setJoyIdAddress(await readSignerAddress(signer));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to connect to JoyID",
      );
      setJoyIdSigner(null);
      setJoyIdAutoRestored(false);
      setJoyIdAddress(null);
    } finally {
      setConnecting(false);
    }
  }, [client]);

  const handleDisconnect = useCallback(async () => {
    setError(null);
    joyIdRejected.current = true;
    const active = joyIdSigner;
    setJoyIdSigner(null);
    setJoyIdAutoRestored(false);
    setJoyIdAddress(null);
    if (active) {
      try {
        // Clears JoyID's stored grant, so a reload will not restore it back.
        await active.disconnect();
      } catch {
        // A stale session is not worth surfacing; local state is cleared anyway.
      }
    }
    disconnect();
  }, [disconnect, joyIdSigner]);

  const value = useMemo<WalletState>(() => {
    // A signer the user just picked outranks one a reload merely rediscovered,
    // so a restored JoyID session yields to an incoming connector wallet.
    const joyIdWins =
      joyIdSigner !== null && !(joyIdAutoRestored && connectorSigner);
    const signer = joyIdWins ? joyIdSigner : (connectorSigner ?? undefined);
    const address = joyIdWins
      ? joyIdAddress
      : connectorSigner
        ? connectorAddress
        : null;

    return {
      signer,
      // Gating on the active signer keeps a stale address from a previous
      // connection from leaking after a disconnect.
      address,
      source: joyIdWins ? "joyid" : connectorSigner ? "connector" : null,
      connecting,
      restoring,
      error,
      openConnector: () => void open(),
      connectJoyId: () => void handleConnectJoyId(),
      disconnect: () => void handleDisconnect(),
    };
  }, [
    joyIdSigner,
    joyIdAddress,
    connectorSigner,
    connectorAddress,
    connecting,
    restoring,
    joyIdAutoRestored,
    error,
    open,
    handleConnectJoyId,
    handleDisconnect,
  ]);

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

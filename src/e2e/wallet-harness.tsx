import type { ccc } from "@ckb-ccc/ccc";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { WalletContext, type WalletState } from "@/context/WalletProvider";

/**
 * Deterministic CKB addresses used by the browser tests.
 *
 * They are the same public testnet fixtures the jsdom suite already uses. No
 * private key, seed phrase or real wallet exists behind them: the harness
 * signer only returns a constant signature.
 */
export const HARNESS_ADDRESS =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq";
export const HARNESS_ALT_ADDRESS =
  "ckt1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu";

declare global {
  interface Window {
    __e2eWallet?: {
      /** Simulates a connector handing over a different account. */
      setAddress: (address: string | null) => void;
      /** Number of `signMessage` calls the in-page signer has seen. */
      signatureCount: () => number;
    };
  }
}

/**
 * The wallet integration boundary for browser tests.
 *
 * It provides the same context contract as the production `WalletProvider`, but
 * replaces JoyID/CCC with a controllable signer. Real components, routing,
 * auth, verification and layout are still exercised; only the external wallet
 * service is swapped out.
 */
export function TestWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddressState] = useState<string | null>(null);
  const [source, setSource] = useState<WalletState["source"]>(null);
  const [connecting, setConnecting] = useState(false);
  const signatures = useRef(0);

  const setAddress = useCallback((next: string | null) => {
    setAddressState(next);
    setSource(next ? "joyid" : null);
  }, []);

  const signer = useMemo<ccc.Signer | undefined>(() => {
    if (!address) return undefined;

    return {
      getInternalAddress: async () => address,
      isConnected: async () => true,
      connect: async () => undefined,
      disconnect: async () => undefined,
      signMessage: async () => {
        signatures.current += 1;
        return `0x${"1".repeat(128)}`;
      },
    } as unknown as ccc.Signer;
  }, [address]);

  const connectJoyId = useCallback(() => {
    setConnecting(true);
    // A short delay keeps the real "Connecting…" state observable rather than
    // completing inside the same frame as the click.
    window.setTimeout(() => {
      setAddress(HARNESS_ADDRESS);
      setConnecting(false);
    }, 25);
  }, [setAddress]);

  const openConnector = useCallback(() => {
    setAddressState(HARNESS_ADDRESS);
    setSource("connector");
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, [setAddress]);

  useEffect(() => {
    window.__e2eWallet = {
      setAddress,
      signatureCount: () => signatures.current,
    };
    return () => {
      delete window.__e2eWallet;
    };
  }, [setAddress]);

  const value = useMemo<WalletState>(
    () => ({
      signer,
      address,
      source,
      connecting,
      restoring: false,
      error: null,
      openConnector,
      connectJoyId,
      disconnect,
    }),
    [
      signer,
      address,
      source,
      connecting,
      openConnector,
      connectJoyId,
      disconnect,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

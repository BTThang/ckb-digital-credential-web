import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletProvider";
import { shortAddress } from "@/utils/format";

/**
 * Wallet connection control, including the explicit sign-in step.
 *
 * Connecting a wallet and signing in are separate acts on purpose: connecting
 * only yields a signer, while signing in proves that the signer really controls
 * the address the session belongs to. Nothing is ever signed silently - the
 * user has to press Sign in.
 *
 * Once there is a session the account menu takes over: logout and disconnect
 * both live in `UserMenu`, so this control degrades to a passive status badge.
 * Showing a disconnect here too would give the header two buttons for one act.
 */
export default function WalletButton() {
  const {
    signer,
    address,
    source,
    connecting,
    restoring,
    connectJoyId,
    openConnector,
  } = useWallet();
  const { user, signingIn, signIn } = useAuth();

  if (!signer) {
    // A reload can restore a wallet session without any user interaction. The
    // buttons stay disabled until that settles so the header does not flash
    // "Connect" at someone who is already connected.
    if (restoring) {
      return (
        <div className="row">
          <span className="btn btn-sm" aria-disabled="true">
            <span className="spinner" aria-hidden="true" />
            Restoring wallet…
          </span>
        </div>
      );
    }

    return (
      <div className="row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={connectJoyId}
          disabled={connecting}
        >
          {connecting ? <span className="spinner" aria-hidden="true" /> : null}
          {connecting ? "Connecting…" : "Connect JoyID"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={openConnector}
          disabled={connecting}
        >
          Other wallets
        </button>
      </div>
    );
  }

  return (
    <div className="row">
      <span className="badge" title={address ?? undefined}>
        {source === "joyid" ? "JoyID" : "Wallet"} ·{" "}
        {shortAddress(address ?? "…")}
      </span>

      {/* Signed in, the account menu is the single place both logout and
          disconnect can be reached, so only the sign-in step lives here. */}
      {!user ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void signIn()}
          disabled={signingIn}
        >
          {signingIn ? <span className="spinner" aria-hidden="true" /> : null}
          {signingIn ? "Waiting for signature…" : "Sign in"}
        </button>
      ) : null}
    </div>
  );
}

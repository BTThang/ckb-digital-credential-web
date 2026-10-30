import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletProvider";

/**
 * Wallet connection control, including the explicit sign-in step.
 *
 * Connecting a wallet and signing in are separate acts on purpose: connecting
 * only yields a signer, while signing in proves that the signer really controls
 * the address the session belongs to. Nothing is ever signed silently - the
 * user has to press Sign in.
 *
 * A connected wallet is represented by the clickable address in `UserMenu`,
 * which is also where its information and Disconnect live. Repeating the
 * provider and address here as a passive badge duplicated the same identity in
 * the header, so this control only adds the sign-in step that is still missing.
 */
export default function WalletButton() {
  const { signer, connecting, restoring, connectJoyId, openConnector } =
    useWallet();
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

  // Signed in, the wallet menu already exposes the account; nothing is missing.
  if (user) return null;

  return (
    <div className="row">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => void signIn()}
        disabled={signingIn}
      >
        {signingIn ? <span className="spinner" aria-hidden="true" /> : null}
        {signingIn ? "Waiting for signature…" : "Sign in"}
      </button>
    </div>
  );
}

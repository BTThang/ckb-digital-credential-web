import CopyButton from "@/components/CopyButton";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletProvider";
import { shortAddress } from "@/utils/format";
import { NavLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

/**
 * The signed-in user's menu, and the only place logout and disconnect live.
 *
 * Logout and disconnect are deliberately separate entries: logging out ends the
 * application session, disconnecting only drops the signer from the browser.
 * `WalletButton` used to offer its own disconnect as well, which left the header
 * with two buttons for the same act.
 */
export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { address, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  // Tracked as the url that failed rather than a boolean, so a later edit to the
  // profile that fixes the image is picked up instead of staying stuck.
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  // A menu left open by a navigation would follow the user around.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  if (!user) return null;

  const label = user.displayName ?? shortAddress(user.walletAddress);
  const avatar =
    user.avatarUrl && user.avatarUrl !== failedAvatar ? user.avatarUrl : null;
  const initial = (user.displayName?.trim() || user.walletAddress)
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="user-menu" ref={container}>
      <button
        type="button"
        className="btn btn-sm user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {/* The avatar is decoration next to the name, so it stays out of the
            accessible name and the button is still read as just the label. */}
        <span className="user-menu-avatar" aria-hidden="true">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedAvatar(avatar)}
            />
          ) : (
            initial
          )}
        </span>
        <span className="user-menu-name">{label}</span>
        {/* Purely decorative: the chevron only says "there is more below", which
            `aria-haspopup` and `aria-expanded` already state semantically. */}
        <span className="user-menu-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">
            <strong>{user.displayName ?? "Signed in"}</strong>
            <span className="small muted break">{user.walletAddress}</span>
            <CopyButton value={user.walletAddress} label="Copy address" />
          </div>

          <NavLink to="/profile" role="menuitem" onClick={close}>
            Profile
          </NavLink>
          <NavLink to="/my" role="menuitem" onClick={close}>
            My Credentials
          </NavLink>
          <NavLink to="/issued" role="menuitem" onClick={close}>
            Issued Credentials
          </NavLink>

          <button
            type="button"
            role="menuitem"
            className="user-menu-action"
            onClick={() => {
              close();
              void signOut();
            }}
          >
            Logout
          </button>
          {address ? (
            <button
              type="button"
              role="menuitem"
              className="user-menu-action"
              onClick={() => {
                close();
                disconnect();
              }}
            >
              Disconnect wallet
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

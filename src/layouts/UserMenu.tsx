import CopyButton from "@/components/CopyButton";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletProvider";
import { shortAddress } from "@/utils/format";
import { NavLink } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The account menu. It owns both the session actions and the wallet actions.
 *
 * Wallet connection and application login are independent states, so the menu
 * renders whenever either one exists. A connected wallet that is not signed in
 * still needs a way to disconnect - hiding this menu until login would leave the
 * connector active with no visible way to drop it. Logout and disconnect remain
 * separate entries: logout ends the session, disconnect only drops the signer.
 */
export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { address, source, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  // Tracked as the url that failed rather than a boolean, so a later edit to the
  // profile that fixes the image is picked up instead of staying stuck.
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  // Horizontal offset of the panel relative to the trigger. A fixed `right: 0`
  // makes the menu hang off the left edge once the header wraps on a narrow
  // viewport, so the offset is clamped to the viewport instead.
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

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

  // Keep the panel inside the viewport at every width. It stays absolutely
  // positioned so it remains anchored to the trigger while the sticky header
  // scrolls with the page.
  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const anchor = trigger.current;
      if (!anchor) return;

      const margin = 12;
      // jsdom reports no layout, so the declared minimum is the honest fallback.
      const width = panel.current?.offsetWidth || 236;
      const rect = anchor.getBoundingClientRect();
      const maxLeft = window.innerWidth - margin - width;
      const viewportLeft = Math.min(
        Math.max(rect.right - width, margin),
        Math.max(margin, maxLeft),
      );
      setPanelLeft(viewportLeft - rect.left);
    }

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  function close() {
    setOpen(false);
  }

  if (!user && !address) return null;

  const walletOnly = !user;
  const providerLabel = source === "joyid" ? "JoyID" : "Wallet";
  const label = user
    ? (user.displayName ?? shortAddress(user.walletAddress))
    : shortAddress(address!);
  const avatar =
    user?.avatarUrl && user.avatarUrl !== failedAvatar ? user.avatarUrl : null;
  const initial = (user?.displayName?.trim() || user?.walletAddress || address || "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="user-menu" ref={container}>
      <button
        type="button"
        ref={trigger}
        className="btn btn-sm user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={walletOnly ? `Wallet menu, ${shortAddress(address!)}` : undefined}
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
        <div
          className="user-menu-panel"
          role="menu"
          ref={panel}
          style={panelLeft === null ? undefined : { left: panelLeft, right: "auto" }}
        >
          <div className="user-menu-header">
            {user ? (
              <>
                <strong>{user.displayName ?? "Signed in"}</strong>
                <span className="small muted break">{user.walletAddress}</span>
                <CopyButton value={user.walletAddress} label="Copy address" />
              </>
            ) : (
              <>
                <strong>Connected wallet</strong>
                <span className="small muted break">{address}</span>
                <CopyButton value={address!} label="Copy address" />
              </>
            )}
            {address ? (
              <span className="small muted">Connected via {providerLabel}</span>
            ) : null}
          </div>

          {user ? (
            <>
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
            </>
          ) : null}
          {address ? (
            <button
              type="button"
              role="menuitem"
              className={
                user ? "user-menu-action" : "user-menu-action user-menu-action-first"
              }
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

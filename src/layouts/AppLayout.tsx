import { NavLink, Outlet } from "react-router-dom";

import { Alert } from "@/components/ui";
import { API_BASE_URL, EXPLORER_URL, NETWORK } from "@/config";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletProvider";

import NetworkBadge from "./NetworkBadge";
import UserMenu from "./UserMenu";
import WalletButton from "./WalletButton";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/credentials", label: "Credentials" },
  { to: "/issue", label: "Issue" },
  { to: "/verify", label: "Verify" },
  { to: "/transactions", label: "Transactions" },
];

/** The application shell: header navigation, the routed page, and the footer. */
export default function AppLayout() {
  const { error: walletError } = useWallet();
  const { error: authError } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <span>CKB Credential</span>
        </NavLink>

        <nav className="app-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <NetworkBadge />
        {/* WalletButton covers connection + sign-in; UserMenu covers the session. */}
        <WalletButton />
        <UserMenu />
      </header>

      <main className="app-main">
        {walletError ? (
          <div style={{ marginBottom: 18 }}>
            <Alert kind="error" title="Wallet error">
              {walletError}
            </Alert>
          </div>
        ) : null}
        {authError ? (
          <div style={{ marginBottom: 18 }}>
            <Alert kind="error" title="Sign-in error">
              {authError}
            </Alert>
          </div>
        ) : null}
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>
          Network: <strong>{NETWORK}</strong>
        </span>
        <span>
          API: <code>{API_BASE_URL}</code>
        </span>
        <a href={EXPLORER_URL} target="_blank" rel="noreferrer noopener">
          CKB Explorer
        </a>
        <span className="muted small">
          Chain is the source of truth. The API index is a cache.
        </span>
      </footer>
    </div>
  );
}

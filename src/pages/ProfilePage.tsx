import { useState, type FormEvent } from "react";

import CopyButton from "@/components/CopyButton";
import { Alert, Card, Spinner } from "@/components/ui";
import { useAuth, useIsConnectedWallet } from "@/context/AuthProvider";
import { api } from "@/services/api";
import {
  ORGANIZATION_TYPES,
  type OrganizationType,
  type UpdateProfilePayload,
} from "@/types";
import { addressExplorerUrl } from "@/utils/explorer";
import { humanizeToken } from "@/utils/format";

/**
 * The signed-in user's profile.
 *
 * The wallet address is displayed but not editable: it is the proven identity,
 * and changing it is the same as becoming someone else. Everything else is
 * self-declared and free to edit.
 */
export default function ProfilePage() {
  const { user, initializing, refresh } = useAuth();
  const sameWallet = useIsConnectedWallet();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState<
    OrganizationType | ""
  >("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // The header shows the same avatar, so a dead url would break it in two
  // places at once. Clearing the flag on every edit makes a fixed url recover.
  const profileAvatar = avatarFailed ? null : user?.avatarUrl || null;
  const profileInitial = (
    user?.displayName?.trim() || user?.walletAddress || "?"
  )
    .slice(0, 1)
    .toUpperCase();

  // Seed the form once the user arrives; the provider loads it asynchronously.
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (user && seededFor !== user.id) {
    setSeededFor(user.id);
    setDisplayName(user.displayName ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
    setBio(user.bio ?? "");
    setOrganizationName(user.organizationName ?? "");
    setOrganizationType(user.organizationType ?? "");
    setAvatarFailed(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    // Only the fields this form actually owns are sent, so an untouched field
    // is never overwritten with an empty value.
    const payload: UpdateProfilePayload = {
      displayName: displayName.trim(),
      avatarUrl: avatarUrl.trim(),
      bio: bio.trim(),
      organizationName: organizationName.trim(),
      organizationType: organizationType || null,
    };

    try {
      await api.updateProfile(payload);
      // Re-read rather than trusting local state, so the form reflects exactly
      // what was stored (trimmed, or coerced by the server).
      await refresh();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (initializing) return <Spinner label="Restoring your session…" />;
  if (!user) {
    return (
      <Alert kind="warning" title="Not signed in">
        Connect a wallet and sign in to view your profile.
      </Alert>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile</h1>
        <p>
          Your wallet address is your identity and cannot be changed. Everything
          below is yours to edit.
        </p>
      </div>

      {!sameWallet ? (
        <Alert kind="info" title="Different wallet connected">
          You are signed in as a different wallet than the one currently
          connected. Editing here still changes the signed-in account.
        </Alert>
      ) : null}

      <Card>
        <div className="spread">
          <div className="row identity">
            <span className="identity-avatar" aria-hidden="true">
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                profileInitial
              )}
            </span>
            <div>
              <h2 className="identity-name">{user.displayName ?? "Signed in"}</h2>
              <p className="muted small" style={{ margin: 0 }}>
                {user.organizationName
                  ? `${user.organizationName}${
                      user.organizationType
                        ? ` · ${humanizeToken(user.organizationType)}`
                        : ""
                    }`
                  : "No organization set"}
              </p>
            </div>
          </div>
          <div className="row">
            <a
              className="break"
              href={addressExplorerUrl(user.walletAddress)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {user.walletAddress}
            </a>
            <CopyButton value={user.walletAddress} label="Copy" />
          </div>
        </div>
      </Card>

      <Card>
        <form className="stack" onSubmit={handleSubmit}>
          <h3>Public details</h3>

          <div className="field">
            <label htmlFor="profile-name">Display name</label>
            <input
              id="profile-name"
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="profile-avatar">Avatar URL</label>
            <input
              id="profile-avatar"
              type="url"
              placeholder="https://…"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="profile-bio">Bio</label>
            <textarea
              id="profile-bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="profile-org">Organization</label>
            <input
              id="profile-org"
              type="text"
              maxLength={120}
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="profile-org-type">Organization type</label>
            <select
              id="profile-org-type"
              value={organizationType}
              onChange={(event) =>
                setOrganizationType(event.target.value as OrganizationType | "")
              }
            >
              <option value="">Not specified</option>
              {ORGANIZATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {humanizeToken(value)}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <Alert kind="error" title="Could not save">
              {error}
            </Alert>
          ) : null}
          {saved && !error ? (
            <Alert kind="success" title="Saved">
              Your profile has been updated.
            </Alert>
          ) : null}

          <div className="row" style={{ marginTop: 14 }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? <span className="spinner" aria-hidden="true" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}

/**
 * Sign-in and profile types.
 *
 * These mirror the backend contract exactly. The one thing deliberately absent
 * is the session token: it lives in an HttpOnly cookie, so JavaScript cannot
 * read it even if it wanted to.
 */

export const ORGANIZATION_TYPES = [
  "company",
  "school",
  "training_center",
  "event_organizer",
  "professional_organization",
  "nonprofit",
  "other",
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

/** The public user shape. `walletAddress` is the only proven field. */
export interface AuthUser {
  id: number;
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  organizationName: string | null;
  organizationType: OrganizationType | null;
}

/** A CCC signature, as `JSON.stringify` survives it. */
export interface WalletSignature {
  signature: string;
  identity: string;
  signType: string;
}

/**
 * The canonical challenge the backend issued.
 *
 * `message` must be signed byte-for-byte: any normalisation on the way to the
 * wallet would produce a signature the backend rejects.
 */
export interface AuthChallenge {
  message: string;
  expiresAt: string;
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface AuthVerifyResult extends AuthSession {
  expiresAt: string;
}

/**
 * A profile edit.
 *
 * `null` clears a field; leaving a key out leaves the stored value alone, which
 * is what `PATCH` means.
 */
export interface UpdateProfilePayload {
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  organizationName?: string | null;
  organizationType?: OrganizationType | null;
}

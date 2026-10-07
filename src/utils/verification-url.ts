/**
 * The public, shareable verification URL for a credential (spec Phase 4).
 *
 * Built from the live origin so it is correct on any host (local dev, Vercel,
 * a custom domain) and contains only the Spore id — never a session, token or
 * secret. This exact string is what the QR encodes.
 */
export function verificationUrl(sporeId: string): string {
  return `${window.location.origin}/verify/${encodeURIComponent(sporeId)}`;
}
import type { Credential } from "@/types";

/**
 * The four lifecycle states from `docs/domain-model.md`.
 *
 * A transfer keeps the credential ACTIVE — only the cell's owner changes — so
 * TRANSFERRED describes ownership history, never a second "dead" status.
 * Revocation is a melt, which the chain then reports as NOT_FOUND.
 */
export type LifecycleState = "ACTIVE" | "TRANSFERRED" | "REVOKED" | "NOT_FOUND";

/** Projects an indexed record onto the lifecycle vocabulary. */
export function lifecycleState(credential: Credential): LifecycleState {
  if (credential.status === "melted") return "REVOKED";
  if (credential.status === "unknown") return "NOT_FOUND";
  return credential.ownerAddress === credential.recipientAddress
    ? "ACTIVE"
    : "TRANSFERRED";
}
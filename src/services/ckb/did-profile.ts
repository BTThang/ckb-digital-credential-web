import { ccc } from "@ckb-ccc/ccc";

import { getCkbClient } from "./client";

/**
 * A public `did:ckb` profile published by an address.
 *
 * Everything in here is self-asserted metadata carried by a DID Metadata Cell.
 * It is **informational only**: it never takes part in the credential
 * verification, never decides ownership and never changes a verdict. A DID
 * profile is a claim the publisher makes about itself, not proof of anything.
 */
export interface DidProfile {
  /** The `did:ckb:` identifier of the cell this profile came from. */
  did: string;
  name: string | null;
  bio: string | null;
  alsoKnownAs: string[];
  /** Service ids the document declares, with the type it declares for them. */
  services: Array<{ id: string; type: string | null }>;
}

/**
 * How many DID cells one lookup may read.
 *
 * The lookup is a lock-scoped scan, so an address that published a lot of DID
 * cells must not turn the verify page into an unbounded read.
 */
const LOOKUP_LIMIT = 10;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toProfile(record: ccc.didCkb.DidCkbRecord): DidProfile {
  const document =
    record.data.value.document && typeof record.data.value.document === "object"
      ? (record.data.value.document as Record<string, unknown>)
      : null;

  const services: DidProfile["services"] = [];
  const rawServices = document?.services;
  if (
    rawServices &&
    typeof rawServices === "object" &&
    !Array.isArray(rawServices)
  ) {
    for (const [id, value] of Object.entries(
      rawServices as Record<string, unknown>,
    )) {
      services.push({
        id,
        type:
          value && typeof value === "object"
            ? asText((value as Record<string, unknown>).type)
            : asText(value),
      });
    }
  }

  return {
    did: record.did,
    name: asText(document?.name),
    bio: asText(document?.bio),
    alsoKnownAs: asTextList(document?.alsoKnownAs),
    services,
  };
}

/**
 * Reads the public DID profiles published by an address.
 *
 * The lookup reads the DID Metadata Cells whose **lock** is the address' own
 * lock script, so a profile can only ever be shown for the address that really
 * controls it - the profile is attached to the address by the chain, not by
 * anything the page was told.
 *
 * The address must resolve on the configured network: a mainnet address on
 * testnet fails to resolve and simply yields no profile, so a network mismatch
 * fails closed.
 *
 * This never throws. A missing indexer or an unreachable node means "no
 * profile to show", because the profile is optional decoration and must never
 * disturb the verification.
 */
export async function fetchDidProfiles(address: string): Promise<DidProfile[]> {
  if (!address) return [];

  try {
    const client = getCkbClient();
    const resolved = await ccc.Address.fromString(address, client);
    const records = await ccc.didCkb.listDidCkbsByLock({
      client,
      lock: resolved.script,
      limit: LOOKUP_LIMIT,
    });
    return records.map(toProfile);
  } catch {
    return [];
  }
}

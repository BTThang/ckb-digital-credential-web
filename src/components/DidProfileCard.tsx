import { Panel } from "@/components/ui";
import type { DidProfile } from "@/services/ckb/did-profile";

/**
 * The public `did:ckb` profile published by the connected address.
 *
 * This is decoration, deliberately kept out of the verification path: the
 * profile is self-asserted metadata, so the card says so plainly and never
 * implies that the identity behind the address was verified.
 *
 * The avatar is intentionally not rendered. The avatar url in a DID document
 * is chosen by whoever published the cell, so loading it would tell a third
 * party that the reader of this page is using this application. The profile is
 * therefore shown as text only.
 */
export default function DidProfileCard({
  profiles,
}: {
  profiles: DidProfile[];
}) {
  if (profiles.length === 0) return null;

  return (
    <Panel
      title={<h3>Public DID profile</h3>}
      className="did-profile"
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        Published on chain by the connected address. Informational only.
      </p>

      {profiles.map((profile) => (
        <dl className="dl" key={profile.did}>
          <dt>DID</dt>
          <dd className="break mono">{profile.did}</dd>
          {profile.name ? (
            <>
              <dt>Name</dt>
              <dd>{profile.name}</dd>
            </>
          ) : null}
          {profile.bio ? (
            <>
              <dt>Bio</dt>
              <dd>{profile.bio}</dd>
            </>
          ) : null}
          {profile.alsoKnownAs.length > 0 ? (
            <>
              <dt>Also known as</dt>
              <dd>{profile.alsoKnownAs.join(", ")}</dd>
            </>
          ) : null}
          {profile.services.length > 0 ? (
            <>
              <dt>Services</dt>
              <dd>
                {profile.services
                  .map(
                    (service) =>
                      `${service.id}${service.type ? ` (${service.type})` : ""}`,
                  )
                  .join(", ")}
              </dd>
            </>
          ) : null}
        </dl>
      ))}

      <p className="muted small" style={{ marginBottom: 0 }}>
        A DID profile is a claim the publisher makes about itself. It is not
        proof of identity, and it does not affect the verification result: the
        credential&apos;s owner is read from the chain.
      </p>
    </Panel>
  );
}

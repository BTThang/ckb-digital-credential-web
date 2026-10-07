import { useState } from "react";

import CopyButton from "@/components/CopyButton";
import Dialog from "@/components/Dialog";
import QrCode from "@/components/QrCode";
import { verificationUrl } from "@/utils/verification-url";

/**
 * A "present this credential" action for any role that holds or issued it.
 *
 * Issuer and holder both need to hand a verifier something to scan; neither
 * needs an account for the verifier to read it. The dialog shows the public
 * `/verify/:credentialId` URL as a QR code, as a copyable link, and as a direct
 * link — all three carry the Spore id and nothing else.
 */
export default function ShareQrButton({
  sporeId,
  label = "Share",
}: {
  sporeId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const url = verificationUrl(sporeId);

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
        {label}
      </button>

      {open ? (
        <Dialog
          title="Credential verification"
          busy={false}
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
          confirmLabel="Close"
          error={null}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            Scan to verify this credential on CKB. The code contains only the
            public verification URL — no account, session or secret.
          </p>
          <div style={{ textAlign: "center", margin: "12px 0" }}>
            <QrCode value={url} size={220} />
          </div>
          <p className="mono small break" style={{ textAlign: "center" }}>
            {url}
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <CopyButton value={url} label="Copy link" />
            <a
              className="btn btn-sm"
              href={url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open verification page
            </a>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
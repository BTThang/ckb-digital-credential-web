import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Alert, Spinner } from "@/components/ui";

interface QrState {
  value: string;
  src: string | null;
  error: string | null;
}

/**
 * Renders a QR code for the public verification URL.
 *
 * The code contains only that URL — never a session, token or secret — which is
 * the whole point of Phase 4. It is rendered locally by `qrcode`, so the URL is
 * not sent to a third-party image service.
 */
export default function QrCode({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const [state, setState] = useState<QrState | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(value, { width: size, margin: 2 })
      .then((src) => {
        if (!cancelled) setState({ value, src, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            value,
            src: null,
            error: error instanceof Error ? error.message : "Unable to render QR",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  // A pending render for a previous value must not be shown for this one.
  const current = state?.value === value ? state : null;

  if (current?.error) {
    return (
      <Alert kind="error" title="QR code unavailable">
        {current.error}
      </Alert>
    );
  }

  if (!current?.src) {
    return <Spinner label="Building the QR code…" />;
  }

  return (
    <img
      src={current.src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      style={{ border: "1px solid var(--border-strong)", borderRadius: 6 }}
    />
  );
}
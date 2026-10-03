import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the value is always visible via title.
    }
  }

  return (
    <button
      type="button"
      className="btn btn-sm copy-btn"
      onClick={() => void copy()}
      aria-label={`${label} to clipboard`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export default CopyButton;

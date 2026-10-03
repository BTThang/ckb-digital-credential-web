import { useEffect, useRef, type ReactNode } from "react";

import { Alert } from "@/components/ui";

interface DialogProps {
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  danger?: boolean;
  error: string | null;
  children: ReactNode;
}

/**
 * A native `<dialog>` gives focus trapping, Escape handling and an inert
 * background for free, which is most of the accessibility work a modal needs.
 *
 * The exception is `busy`. `showModal()` promotes the dialog to the browser's
 * top layer, which stacks above every `z-index` in the document, and it makes
 * the rest of the document `inert` so it stops receiving clicks. Both effects
 * swallow the wallet's own signing request UI, which is a plain DOM element,
 * leaving Approve/Reject unclickable while this dialog sits on "Waiting…". So
 * while a write is in flight the dialog drops back out of the top layer to keep
 * the page interactive.
 */
export default function Dialog({
  title,
  busy,
  onCancel,
  onConfirm,
  confirmLabel,
  danger = false,
  error,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !node.isConnected) return;
    if (busy) {
      // `show()` throws if the dialog is already open in any mode, so the modal
      // has to be torn down first.
      if (node.open) node.close();
      node.show();
    } else if (!node.open) {
      node.showModal();
    }
  }, [busy]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      // Escape must not silently discard a signed-in-progress write.
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onCancel();
      }}
    >
      <form
        className="dialog-body"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
        </div>

        {children}

        {error ? (
          <Alert kind="error" title="Transaction failed">
            {error}
          </Alert>
        ) : null}

        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Waiting…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}

import type { ReactNode } from "react";

/** Maps a domain status onto the badge variant defined in styles.css. */
export function badgeClass(value: string): string {
  switch (value) {
    case "verified":
    case "active":
    case "committed":
      return "badge badge-verified";
    case "pending":
    case "submitted":
      return "badge badge-pending";
    case "unable_to_verify":
      return "badge badge-unable";
    case "not_found":
    case "failed":
    case "melted":
      return "badge badge-melted";
    default:
      return "badge badge-unknown";
  }
}

export function StatusBadge({
  value,
  label,
  children,
}: {
  value: string;
  /** Used when no children are provided. */
  label?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`${badgeClass(value)} badge-dot`}>
      {children ?? label ?? value}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

/**
 * A single number with its label.
 *
 * Built here rather than per page so the label/value spacing stays identical
 * across the dashboard and the detail views.
 */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

/** A titled block, for panels that do not need to be a `<section>`. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`.trim()}>
      {title || action ? (
        <div className="card-title">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Alert({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "error" | "success" | "warning";
  title?: string;
  children: ReactNode;
}) {
  const icon = { info: "ℹ", error: "⚠", success: "✓", warning: "⚠" }[kind];

  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span className="alert-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="alert-body">
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon = "◍",
  title,
  children,
  action,
  large = false,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Fills the viewport, for a page whose entire content is the empty state. */
  large?: boolean;
}) {
  return (
    <div className={large ? "empty empty-lg" : "empty"}>
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <strong className="empty-title">{title}</strong>
      {children ? <span className="small empty-body">{children}</span> : null}
      {action}
    </div>
  );
}

/**
 * Renders the full value on hover/focus and a truncated copy otherwise, which
 * keeps long hashes and bech32 addresses from breaking the layout.
 */
export function Hash({
  value,
  head = 10,
  tail = 8,
  href,
}: {
  value: string;
  head?: number;
  tail?: number;
  href?: string;
}) {
  const truncated =
    value.length <= head + tail + 1
      ? value
      : `${value.slice(0, head)}…${value.slice(-tail)}`;

  const text = <span title={value}>{truncated}</span>;

  return href ? (
    <a className="hash" href={href} target="_blank" rel="noreferrer noopener">
      {text}
    </a>
  ) : (
    <span className="hash">{text}</span>
  );
}

export function shortId(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function shortAddress(address: string): string {
  if (address.startsWith("ckb1") || address.startsWith("ckt1")) {
    return `${address.slice(0, 10)}…${address.slice(-6)}`;
  }
  return shortId(address);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // A bare `YYYY-MM-DD` is read as UTC midnight, otherwise the browser's own
  // offset can shift it to the previous day.
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value,
  );
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function isExpired(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;
  return new Date(`${expirationDate}T23:59:59Z`).getTime() < Date.now();
}

/** `COURSE_COMPLETION` -> `course completion`, for display only. */
export function humanizeToken(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

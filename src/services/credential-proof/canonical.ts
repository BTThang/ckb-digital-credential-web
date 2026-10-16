/**
 * Deterministic canonicalization for the credential envelope.
 *
 * Byte-identical to the service's implementation: the signature is checked
 * between packages, so the canonicalizer must never drift. A pinned test
 * vector exists in both suites.
 */

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export class NonCanonicalValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonCanonicalValueError";
  }
}

export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isInteger(value)) {
        throw new NonCanonicalValueError(
          `Only integers can be canonicalized (got ${value})`,
        );
      }
      return String(value);
    case "bigint":
      throw new NonCanonicalValueError("BigInt is not a canonicalizable value");
    case "undefined":
      throw new NonCanonicalValueError("undefined is not a canonicalizable value");
    case "function":
    case "symbol":
      throw new NonCanonicalValueError(`${typeof value} is not a canonicalizable value`);
    default:
      break;
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = value as Record<string, unknown>;
    const keys = Object.keys(entries).sort();
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(entries[key])}`)
      .join(",");
    return `{${body}}`;
  }

  throw new NonCanonicalValueError(`Cannot canonicalize value of type ${typeof value}`);
}

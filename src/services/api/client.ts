import { API_BASE_URL } from "@/config";

/** An error response from the API, carrying the backend's machine-readable code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * The request never produced an HTTP response at all: the connection was
 * refused, DNS failed, TLS was rejected, the browser blocked it on CORS, or the
 * attempt timed out.
 *
 * These are indistinguishable from inside the page - `fetch` rejects every one
 * of them with the same opaque `TypeError: Failed to fetch` - so they all
 * extend `ApiError` with status `0` and the code `NETWORK_ERROR`, letting a
 * caller tell "the server said no" apart from "the server was never reached".
 */
export class NetworkError extends ApiError {
  readonly url: string;

  constructor(message: string, url: string, options?: { cause?: unknown }) {
    super(0, "NETWORK_ERROR", message);
    this.name = "NetworkError";
    this.url = url;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

/**
 * Without this a request to a wedged or half-open socket hangs forever and the
 * spinner never resolves, which reads as a slower version of the same bug.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Turns a rejected `fetch` into something a user can act on. The browser's own
 * message ("Failed to fetch") names neither the URL nor the usual culprits, and
 * a CORS rejection in particular is indistinguishable from a stopped server.
 */
function toNetworkError(url: URL, cause: unknown): NetworkError {
  const timedOut =
    cause instanceof DOMException &&
    (cause.name === "TimeoutError" || cause.name === "AbortError");

  const reason = timedOut
    ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
    : "was unreachable (the service may be stopped, or CORS may be blocking this origin)";

  return new NetworkError(
    `Could not reach the API at ${url.origin} - it ${reason}.`,
    url.href,
    { cause },
  );
}

/** Parses a response body, tolerating the empty and non-JSON ones. */
function parseEnvelope<T>(text: string): Envelope<T> {
  if (!text) return {} as Envelope<T>;
  try {
    return JSON.parse(text) as Envelope<T>;
  } catch {
    // A reverse proxy or an SPA fallback answering with an HTML error page
    // arrives here. Reporting it as a parse failure hides the status code.
    return {} as Envelope<T>;
  }
}

/**
 * The single fetch entry point.
 *
 * Every call unwraps the backend's `{ data }` envelope and converts a non-2xx
 * response into an `ApiError`, so callers never branch on HTTP status.
 */
export async function request<T>(
  path: string,
  init?: RequestInit & { query?: QueryParams },
): Promise<Envelope<T>> {
  const { query, ...rest } = init ?? {};
  const url = new URL(`${API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...rest,
      // A caller-supplied signal wins, so per-call cancellation is unaffected.
      signal: rest.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // The session lives in an HttpOnly cookie, so every call has to send it -
      // including the unauthenticated ones, or a just-issued cookie would be
      // dropped on the very next request.
      credentials: "include",
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...rest.headers,
      },
    });
  } catch (cause) {
    // Rejected before any response existed. Left unhandled this surfaces to the
    // UI as the bare string "Failed to fetch".
    throw toNetworkError(url, cause);
  }

  const text = await response.text();
  const body = parseEnvelope<T>(text);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "UNKNOWN",
      // A body that was not our envelope means something between the browser
      // and the service answered instead, so the status is all we can report.
      body.error?.message ??
        (text
          ? `Request failed with status ${response.status}`
          : `Request failed with status ${response.status} (empty response body)`),
      body.error?.details,
    );
  }

  return body;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, NetworkError } from "@/services/api";

/** Catches the client's fetch calls and answers with a canned envelope. */
function mockFetch(body: unknown, init: { status?: number } = {}) {
  const spy = vi.fn().mockResolvedValue({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Answers with a raw string body, for the non-JSON cases. */
function mockTextFetch(text: string, status = 200) {
  const spy = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => text,
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Rejects the way the browser does when no response is ever produced. */
function mockFetchRejection(cause: unknown) {
  const spy = vi.fn().mockRejectedValue(cause);
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("api client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unwraps the data envelope", async () => {
    // The detail endpoint nests the row under `credential`.
    mockFetch({ data: { credential: { id: "cred_1", title: "Course" } } });
    const credential = await api.getCredential("cred_1");

    expect(credential.id).toBe("cred_1");
  });

  it("reads total from meta and falls back to the row count", async () => {
    mockFetch({ data: [{ id: "a" }], meta: { total: 42 } });
    const first = await api.listCredentials();
    expect(first.total).toBe(42);
    expect(first.data).toHaveLength(1);

    mockFetch({ data: [{ id: "a" }, { id: "b" }] });
    const second = await api.listCredentials();
    expect(second.total).toBe(2);
  });

  it("turns an error envelope into an ApiError", async () => {
    mockFetch(
      {
        error: {
          code: "NOT_FOUND",
          message: 'Spore "0xabc" is unknown to the CKB network',
        },
      },
      { status: 404 },
    );

    await expect(api.getCredential("missing")).rejects.toBeInstanceOf(ApiError);
  });

  it("preserves the backend error code and message", async () => {
    mockFetch(
      { error: { code: "CKB_UNAVAILABLE", message: "The CKB RPC node is currently unavailable" } },
      { status: 503 },
    );

    try {
      await api.getTransaction("0xdeadbeef");
      expect.unreachable("the request should have failed");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      const error = cause as ApiError;
      // A node outage must never be reported as "not found".
      expect(error.status).toBe(503);
      expect(error.code).toBe("CKB_UNAVAILABLE");
    }
  });

  it("lowercases and encodes a transaction hash in the path", async () => {
    const spy = mockFetch({
      data: {
        txHash: "0xabc",
        status: "committed",
        found: true,
        chain: { txHash: "0xabc", found: true, status: "committed" },
        indexed: null,
        inSync: null,
      },
    });

    await api.getTransaction("0xAABBCC");

    const url = String(spy.mock.calls[0]![0]);
    expect(url).toContain("/api/transactions/0xaabbcc");
  });

  it("omits empty query parameters instead of sending blanks", async () => {
    const spy = mockFetch({ data: [], meta: { total: 0 } });
    await api.listCredentials({ search: "", status: undefined, limit: 10 });

    const url = new URL(String(spy.mock.calls[0]![0]));
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
  });
});

describe("api transport failures", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the bare browser message with an actionable one", async () => {
    // This is the regression behind "Could not load transactions / Failed to
    // fetch": the browser's message names neither the URL nor the cause, so it
    // is indistinguishable from a stopped server or a blocked origin.
    mockFetchRejection(new TypeError("Failed to fetch"));

    try {
      await api.listTransactions(50);
      expect.unreachable("the request should have failed");
    } catch (cause) {
      expect(cause).toBeInstanceOf(NetworkError);
      const error = cause as NetworkError;
      expect(error.message).not.toMatch(/failed to fetch/i);
      expect(error.message).toContain("http://localhost:3000");
      expect(error.message).toMatch(/CORS|stopped/i);
      // Still an ApiError, so existing `instanceof` handling keeps working.
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
      expect(error.code).toBe("NETWORK_ERROR");
    }
  });

  it("keeps the original failure as the cause", async () => {
    const original = new TypeError("Failed to fetch");
    mockFetchRejection(original);

    await expect(api.listTransactions(50)).rejects.toMatchObject({
      cause: original,
    });
  });

  it("reports a timeout as a timeout rather than as unreachable", async () => {
    mockFetchRejection(new DOMException("The operation was aborted.", "TimeoutError"));

    await expect(api.listTransactions(50)).rejects.toThrow(/timed out after 15s/);
  });

  it("sends an abort signal so a hung request cannot spin forever", async () => {
    const spy = mockFetch({ data: [], meta: { total: 0 } });
    await api.listTransactions(50);

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("survives an HTML body instead of throwing a parse error", async () => {
    // A proxy or SPA fallback answering with an error page must not mask the
    // status code behind a SyntaxError.
    mockTextFetch("<html><body>502 Bad Gateway</body></html>", 502);

    try {
      await api.listTransactions(50);
      expect.unreachable("the request should have failed");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      const error = cause as ApiError;
      expect(error.status).toBe(502);
      expect(error.message).toBe("Request failed with status 502");
    }
  });

  it("returns an empty envelope for an empty body", async () => {
    mockTextFetch("", 204);
    const body = await api.listTransactions(50);
    expect(body.data ?? []).toEqual([]);
  });
});

describe("api session", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the session cookie on every request", async () => {
    // Without this the cookie is silently dropped and the app looks signed out
    // on every call - including the one right after signing in.
    const spy = mockFetch({ data: { authenticated: false, user: null } });
    await api.me();

    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.credentials).toBe("include");
  });

  it("reports signed out as a value, not an error", async () => {
    mockFetch({ data: { authenticated: false, user: null } });
    const session = await api.me();

    expect(session.authenticated).toBe(false);
    expect(session.user).toBeNull();
  });

  it("posts the signed challenge to verify", async () => {
    const spy = mockFetch({
      data: { authenticated: true, user: { id: 1 }, expiresAt: "later" },
    });
    const result = await api.verifyChallenge({
      address: "ckt1qexample",
      message: "sign-in challenge\n",
      signature: { signature: "0xabc", identity: "0x02def", signType: "CkbSecp256k1" },
    });

    // `request` hands `fetch` a URL object, so it has to be stringified first.
    expect(String(spy.mock.calls[0]![0])).toContain("/api/auth/verify");
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      address: "ckt1qexample",
      message: "sign-in challenge\n",
      signature: {
        signature: "0xabc",
        identity: "0x02def",
        signType: "CkbSecp256k1",
      },
    });
    expect(result.authenticated).toBe(true);
  });
});

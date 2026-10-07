import type {
  AuthChallenge,
  AuthSession,
  AuthUser,
  AuthVerifyResult,
  CreateCredentialPayload,
  Credential,
  HealthReport,
  ListCredentialsQuery,
  OwnedSpore,
  PublicVerification,
  SporeVerificationReport,
  TransactionRecord,
  TransactionStatus,
  TransactionStatusReport,
  TransactionType,
  UpdateProfilePayload,
  VerificationReport,
  WalletSignature,
} from "@/types";

import { request } from "./client";

/**
 * Typed wrapper around the backend API.
 *
 * Read-only methods return indexed rows that the caller must treat as a cache.
 * The two `verify*` methods are the exception: they answer from the chain.
 *
 * The `auth*`/`profile*` methods rely on the session cookie, which is why
 * `request` always sends credentials. There is no token to manage in JS.
 */
export const api = {
  async health(): Promise<HealthReport> {
    const { data } = await request<HealthReport>("/api/health");
    return data;
  },

  /** Step 1 of sign-in: ask the server for the canonical challenge. */
  async requestNonce(address: string): Promise<AuthChallenge> {
    const { data } = await request<AuthChallenge>("/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
    return data;
  },

  /**
   * Step 2 of sign-in: hand back the signed challenge.
   *
   * The session is established here, by the `Set-Cookie` on the response. The
   * body deliberately carries no token.
   */
  async verifyChallenge(input: {
    address: string;
    message: string;
    signature: WalletSignature;
  }): Promise<AuthVerifyResult> {
    const { data } = await request<AuthVerifyResult>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data;
  },

  /** Restores a session from the cookie. Never throws when signed out. */
  async me(): Promise<AuthSession> {
    const { data } = await request<AuthSession>("/api/auth/me");
    return data;
  },

  /** Revokes the session server-side and clears the cookie. */
  async logout(): Promise<AuthSession> {
    const { data } = await request<AuthSession>("/api/auth/logout", {
      method: "POST",
    });
    return data;
  },

  async getProfile(): Promise<AuthUser> {
    const { data } = await request<{ user: AuthUser }>("/api/profile");
    return data.user;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    const { data } = await request<{ user: AuthUser }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.user;
  },

  async listCredentials(
    query: ListCredentialsQuery = {},
  ): Promise<{ data: Credential[]; total: number }> {
    const body = await request<Credential[]>("/api/credentials", {
      query: { ...query },
    });
    return {
      data: body.data,
      total: Number(body.meta?.total ?? body.data.length),
    };
  },

  async getCredential(id: string): Promise<Credential> {
    const body = await request<{ credential: Credential }>(
      `/api/credentials/${encodeURIComponent(id)}`,
    );
    return body.data.credential;
  },

  async createCredential(
    payload: CreateCredentialPayload,
  ): Promise<Credential> {
    const { data } = await request<Credential>("/api/credentials", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data;
  },

  async updateCredential(
    id: string,
    patch: Partial<
      Pick<
        Credential,
        | "title"
        | "description"
        | "issuerName"
        | "issuerType"
        | "credentialType"
        | "issueDate"
        | "expirationDate"
      >
    >,
  ): Promise<Credential> {
    const { data } = await request<Credential>(
      `/api/credentials/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    return data;
  },

  async deleteCredential(id: string): Promise<void> {
    await request<void>(`/api/credentials/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** Blockchain-authoritative verification. Never satisfied by the cache. */
  async verifyCredential(id: string): Promise<VerificationReport> {
    const { data } = await request<VerificationReport>(
      `/api/credentials/${encodeURIComponent(id)}/verify`,
    );
    return data;
  },

  async verifySporeId(sporeId: string): Promise<SporeVerificationReport> {
    const { data } = await request<SporeVerificationReport>(
      `/api/spores/${encodeURIComponent(sporeId)}/verify`,
    );
    return data;
  },

  /**
   * `GET /api/verify/:credentialId` - the public verdict for the shareable
   * verification page. The backend decides `valid`/`state` from the chain;
   * the page never re-derives it.
   */
  async verifyCredentialId(credentialId: string): Promise<PublicVerification> {
    const { data } = await request<PublicVerification>(
      `/api/verify/${encodeURIComponent(credentialId)}`,
    );
    return data;
  },

  /** Live Spores held by an address, read from chain (not the index). */
  async listSporesByOwner(
    address: string,
  ): Promise<{ data: OwnedSpore[]; total: number }> {
    const body = await request<OwnedSpore[]>(
      `/api/spores/owner/${encodeURIComponent(address)}`,
    );
    return {
      data: body.data,
      total: Number(body.meta?.total ?? body.data.length),
    };
  },

  async lookupSpore(sporeId: string): Promise<Credential | null> {
    const { data } = await request<Credential | null>("/api/spores/lookup", {
      query: { sporeId },
    });
    return data;
  },

  async syncCredentials(): Promise<{
    credentials: { scanned: number; updated: number };
    network: string;
  }> {
    const { data } = await request<{
      credentials: { scanned: number; updated: number };
      network: string;
    }>("/api/credentials/sync", { method: "POST" });
    return data;
  },

  async listTransactions(
    limit = 25,
    offset = 0,
    sporeId?: string,
  ): Promise<{ data: TransactionRecord[]; total: number }> {
    const body = await request<TransactionRecord[]>("/api/transactions", {
      query: { limit, offset, sporeId },
    });
    // An empty or unexpected body must read as "no rows" rather than throwing on
    // `undefined.length`, which would blank the whole page instead of the list.
    const data = Array.isArray(body.data) ? body.data : [];
    return {
      data,
      total: Number(body.meta?.total ?? data.length),
    };
  },

  async getTransaction(txHash: string): Promise<TransactionStatusReport> {
    const { data } = await request<TransactionStatusReport>(
      `/api/transactions/${encodeURIComponent(txHash.toLowerCase())}`,
    );
    return data;
  },

  async trackTransaction(input: {
    txHash: string;
    credentialId?: string | null;
    sporeId?: string | null;
    type: TransactionType;
    status: TransactionStatus;
    blockNumber?: string | null;
    detail?: string | null;
  }): Promise<TransactionRecord> {
    const { data } = await request<TransactionRecord>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data;
  },
};

export { ApiError, NetworkError } from "./client";
export type { ListCredentialsQuery };

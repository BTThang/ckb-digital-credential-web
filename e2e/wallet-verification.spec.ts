import { expect, test, type Page } from "@playwright/test";

const SPORE_ID = `0x${"1".repeat(64)}`;
const TX_HASH = `0x${"b".repeat(64)}`;
const CONNECTED = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq";
const OTHER = "ckt1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu";
const ALICE = {
  id: 7,
  walletAddress: CONNECTED,
  displayName: "Alice",
  avatarUrl: null,
  bio: null,
  organizationName: null,
  organizationType: null,
};

type Json = Record<string, unknown>;
type HarnessWindow = Window & {
  __e2eWallet?: {
    setAddress: (address: string | null) => void;
    signatureCount: () => number;
  };
};

function sporeReport(): Json {
  return {
    state: "verified",
    indexed: null,
    verification: {
      state: "verified",
      sporeId: SPORE_ID,
      network: "testnet",
      checkedAt: "2026-01-01T00:00:00.000Z",
      sporeExists: true,
      currentOwner: CONNECTED,
      ownerLock: null,
      contentType: "application/json;version=1",
      content: null,
      rawContent: null,
      clusterId: null,
      creationTxHash: TX_HASH,
      creationTxStatus: "committed",
      creationOutputIndex: "0",
      blockNumber: "1234",
      capacity: "1420.1",
      reason: null,
    },
  };
}

function coreResult(over: Json = {}): Json {
  return {
    identifier: SPORE_ID,
    family: "spore",
    supported: true,
    routed: true,
    state: "valid",
    valid: true,
    reason: null,
    checkedAt: "2026-01-01T00:00:00.000Z",
    result: null,
    issuer: null,
    ...over,
  };
}

function ownership(expectedOwner: string, chainOwner: string): Json {
  const matches = expectedOwner === chainOwner;
  return {
    expectedOwner,
    chainOwner,
    matches,
    reason: matches
      ? null
      : "The credential is held by a different address.",
    checkedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface MockState {
  session: Json | null;
  verifyBodies: Json[];
  logoutCalls: number;
}

interface MockOptions {
  session?: Json | null;
  /** The chain owner returned when the request carries an expected owner. */
  chainOwner?: string;
}

/**
 * Fulfils the whole API surface used by the apps under test and records the
 * verification bodies so a test can assert what the browser actually sent.
 */
async function installApi(
  page: Page,
  options: MockOptions = {},
): Promise<MockState> {
  const state: MockState = {
    session: options.session ?? null,
    verifyBodies: [],
    logoutCalls: 0,
  };

  // The verify page reads DID profiles from a public node when a wallet is
  // connected. That is optional decoration; aborting it keeps the suite
  // independent of external services.
  await page.route(
    /^https?:\/\/(?!127\.0\.0\.1|localhost)/,
    (route) => route.abort(),
  );

  // Match by pathname, not `**/api/**`: Vite module URLs such as
  // `/src/services/api/index.ts` contain `/api/` too.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    const fulfill = (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data }),
      });

    if (path === "/api/health") {
      return fulfill({
        status: "ok",
        chain: {
          network: "testnet",
          addressPrefix: "ckt",
          rpcUrl: "http://127.0.0.1:1",
          reachable: true,
          tipBlockNumber: "1",
        },
      });
    }

    if (path === "/api/auth/me") {
      return fulfill({
        authenticated: Boolean(state.session),
        user: state.session,
      });
    }

    if (path === "/api/auth/nonce") {
      return fulfill({
        message: "Sign in to CKB Credential",
        expiresAt: "2026-01-01T00:05:00.000Z",
      });
    }

    if (path === "/api/auth/verify") {
      state.session = ALICE;
      return fulfill({
        authenticated: true,
        user: ALICE,
        expiresAt: "2026-01-08T00:00:00.000Z",
      });
    }

    if (path === "/api/auth/logout") {
      state.logoutCalls += 1;
      state.session = null;
      return fulfill({ authenticated: false, user: null });
    }

    if (path === "/api/credentials") {
      return fulfill([]);
    }

    if (path === "/api/verify/families") {
      return fulfill([
        { family: "spore", description: "Spore credentials" },
        { family: "vellum-claim", description: "Vellum claims" },
        { family: "ckb-pop", description: "CKB-PoP badges" },
      ]);
    }

    if (path === "/api/verify" && method === "POST") {
      const body = (request.postDataJSON() ?? {}) as Json;
      state.verifyBodies.push(body);
      const expectedOwner =
        typeof body.expectedOwner === "string" ? body.expectedOwner : null;

      return fulfill(
        coreResult(
          expectedOwner
            ? {
                ownership: ownership(
                  expectedOwner,
                  options.chainOwner ?? CONNECTED,
                ),
              }
            : {},
        ),
      );
    }

    if (path === "/api/spores/lookup") {
      return fulfill(null);
    }

    if (path.startsWith("/api/spores/") && path.endsWith("/verify")) {
      return fulfill(sporeReport());
    }

    return fulfill(null);
  });

  return state;
}

async function openVerify(page: Page) {
  await page.goto(`/e2e.html#/verify?sporeId=${SPORE_ID}`);
  await expect(
    page.getByRole("heading", { name: "Verify a credential" }),
  ).toBeVisible();
}

async function connectWallet(page: Page) {
  await page.getByRole("button", { name: "Connect JoyID" }).click();
  // A signed-in user has no "Sign in" step; a signed-out one does. Both are
  // connected once the connect control disappears and the menu appears.
  await expect(
    page.getByRole("button", { name: /^(Wallet menu|Alice)/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect JoyID" }),
  ).toHaveCount(0);
}

async function signIn(page: Page) {
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: /^Alice$/ })).toBeVisible();
}

async function useConnectedWallet(page: Page) {
  await page.getByRole("button", { name: "Use connected wallet" }).click();
  await expect(page.getByLabel(/Expected owner address/i)).toHaveValue(
    CONNECTED,
  );
}

function signatureCount(page: Page) {
  return page.evaluate(() => (window as unknown as HarnessWindow).__e2eWallet?.signatureCount() ?? -1);
}

test.describe("wallet connection", () => {
  test("connects a wallet and signs in through the header controls", async ({
    page,
  }) => {
    const api = await installApi(page);
    await openVerify(page);

    await expect(
      page.getByRole("button", { name: "Connect JoyID" }),
    ).toBeVisible();
    await connectWallet(page);
    await expect(
      page.getByRole("button", { name: /Wallet menu/ }),
    ).toBeVisible();

    await signIn(page);

    // The session belongs to the wallet that signed; both live in the header.
    await expect(page.getByRole("button", { name: /^Alice$/ })).toBeVisible();
    expect(api.session).toEqual(ALICE);
    expect(await signatureCount(page)).toBe(1);
  });
});

test.describe("ownership verification", () => {
  test("reports MATCH when the chain owner is the connected wallet", async ({
    page,
  }) => {
    await installApi(page, { chainOwner: CONNECTED });
    await openVerify(page);
    await connectWallet(page);
    await useConnectedWallet(page);

    await page.getByRole("button", { name: "Verify" }).click();

    await expect(
      page.getByText("Held by the expected owner"),
    ).toBeVisible();
    await expect(page.getByText(CONNECTED, { exact: true }).last()).toBeVisible();
  });

  test("reports MISMATCH when the chain owner is a different address", async ({
    page,
  }) => {
    const api = await installApi(page, { chainOwner: OTHER });
    await openVerify(page);
    await connectWallet(page);
    await useConnectedWallet(page);

    await page.getByRole("button", { name: "Verify" }).click();

    await expect(
      page.getByText("Held by a different address", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(OTHER, { exact: true })).toBeVisible();
    // The browser sent the wallet address; only the backend decided `matches`.
    expect(api.verifyBodies.at(-1)?.expectedOwner).toBe(CONNECTED);
  });

  test("follows a wallet account switch without retyping the owner", async ({
    page,
  }) => {
    const api = await installApi(page);
    await openVerify(page);
    await connectWallet(page);
    await useConnectedWallet(page);

    await page.evaluate(
      (address) => (window as unknown as HarnessWindow).__e2eWallet?.setAddress(address),
      OTHER,
    );

    await expect(page.getByLabel(/Expected owner address/i)).toHaveValue(OTHER);
    await expect
      .poll(() => api.verifyBodies.at(-1)?.expectedOwner)
      .toBe(OTHER);
  });

  test("clears a wallet-derived owner when the wallet disconnects", async ({
    page,
  }) => {
    const api = await installApi(page);
    await openVerify(page);
    await connectWallet(page);
    await useConnectedWallet(page);

    await page.getByRole("button", { name: /Wallet menu/ }).click();
    await page.getByRole("menuitem", { name: "Disconnect wallet" }).click();

    await expect(page.getByLabel(/Expected owner address/i)).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Connect JoyID" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Wallet menu/ }),
    ).toHaveCount(0);
    // With no wallet there is nothing to compare against, so the request must
    // not carry a stale expected owner.
    await expect
      .poll(() => api.verifyBodies.at(-1)?.expectedOwner)
      .toBeUndefined();
  });
});

test.describe("session and wallet are independent", () => {
  test("disconnect keeps the signed-in session", async ({ page }) => {
    const api = await installApi(page, { session: ALICE });
    await openVerify(page);
    await connectWallet(page);

    await page.getByRole("button", { name: /^Alice$/ }).click();
    await page.getByRole("menuitem", { name: "Disconnect wallet" }).click();

    // The session survives; only the signer is dropped.
    await expect(page.getByRole("button", { name: /^Alice$/ })).toBeVisible();
    await page.getByRole("button", { name: /^Alice$/ }).click();
    await expect(
      page.getByRole("menuitem", { name: "Disconnect wallet" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: "Logout" }),
    ).toBeVisible();
    expect(api.logoutCalls).toBe(0);
  });

  test("logout keeps the wallet connected", async ({ page }) => {
    const api = await installApi(page, { session: ALICE });
    await openVerify(page);
    await connectWallet(page);

    await page.getByRole("button", { name: /^Alice$/ }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    // The wallet survives; the app session is the only thing that ends.
    await expect(
      page.getByRole("button", { name: /Wallet menu/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(api.logoutCalls).toBe(1);
  });
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("keeps the wallet dropdown and navigation usable at 360px", async ({
    page,
  }) => {
    await installApi(page, { session: ALICE });
    await page.goto("/e2e.html#/");
    await connectWallet(page);

    await page.getByRole("button", { name: /^Alice$/ }).click();
    const panel = page.getByRole("menu");
    await expect(panel).toBeVisible();

    // The regression this guards: the panel used to be anchored with
    // `right: 0`, so once the header wrapped it hung off the left edge.
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);

    // Actions remain reachable instead of being clipped away.
    await expect(
      page.getByRole("menuitem", { name: "Disconnect wallet" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Verify", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Verify a credential" }),
    ).toBeVisible();
  });
});

test.describe("verification stays signature-free", () => {
  test("does not ask the wallet to sign a verification", async ({ page }) => {
    await installApi(page, { chainOwner: CONNECTED });
    await openVerify(page);
    await connectWallet(page);
    await signIn(page);

    const before = await signatureCount(page);
    expect(before).toBe(1);

    await useConnectedWallet(page);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(
      page.getByText("Held by the expected owner"),
    ).toBeVisible();

    // Only the explicit sign-in signed anything. Verification is a read.
    expect(await signatureCount(page)).toBe(before);
  });
});

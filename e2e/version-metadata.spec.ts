import { expect, test } from "@playwright/test";

test.describe("build metadata", () => {
  test("serves a machine-readable version document", async ({ request }) => {
    const response = await request.get("/version.json");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/json");

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.name).toBe("ckb-digital-credential-web");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.environment).toEqual(expect.any(String));
    expect(body.network).toMatch(/^(testnet|mainnet)$/);
    expect(body.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(
      body.commit === null ||
        (typeof body.commit === "string" &&
          /^[0-9a-f]{7,40}$/i.test(body.commit)),
    ).toBe(true);
  });

  test("exposes the same metadata in the document head", async ({
    request,
  }) => {
    const response = await request.get("/");
    const html = await response.text();

    expect(html).toContain('<meta name="app-name"');
    expect(html).toContain('<meta name="app-version"');
    expect(html).toContain('<meta name="git-commit"');
    expect(html).toContain('<meta name="build-time"');
    expect(html).toContain('<meta name="deployment-environment"');
    expect(html).toContain('<meta name="deployment-network"');
  });
});

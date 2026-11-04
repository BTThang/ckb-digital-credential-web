import { describe, expect, it } from "vitest";

import { resolveBuildInfo, type BuildInfoManifest } from "./build-info";

const manifest: BuildInfoManifest = {
  name: "ckb-digital-credential-web",
  version: "2.3.4",
  commit: "1".repeat(40),
  builtAt: "2026-11-03T12:00:00.000Z",
  environment: "production",
};

describe("build metadata", () => {
  it("uses the build values when they are available", () => {
    const build = resolveBuildInfo({
      manifest,
      packageJson: { name: "ignored", version: "0.0.0" },
      env: {
        VERCEL_GIT_COMMIT_SHA: "2".repeat(40),
        NODE_ENV: "development",
      },
      network: "mainnet",
    });

    expect(build).toEqual({
      name: "ckb-digital-credential-web",
      version: "2.3.4",
      commit: "1".repeat(40),
      builtAt: "2026-11-03T12:00:00.000Z",
      environment: "production",
      network: "mainnet",
    });
  });

  it("falls back to package metadata and deployment variables", () => {
    const build = resolveBuildInfo({
      manifest: null,
      packageJson: {
        name: "ckb-digital-credential-web",
        version: "1.0.0",
      },
      env: {
        VERCEL_GIT_COMMIT_SHA: "2".repeat(40),
        VERCEL_ENV: "preview",
      },
      network: "testnet",
    });

    expect(build.name).toBe("ckb-digital-credential-web");
    expect(build.version).toBe("1.0.0");
    expect(build.commit).toBe("2".repeat(40));
    expect(build.builtAt).toBeNull();
    expect(build.environment).toBe("preview");
  });

  it("returns null metadata instead of guessing when it is unavailable", () => {
    const build = resolveBuildInfo({
      manifest: null,
      packageJson: {},
      env: {},
      network: "testnet",
    });

    expect(build).toEqual({
      name: "ckb-digital-credential-web",
      version: "0.0.0",
      commit: null,
      builtAt: null,
      environment: "development",
      network: "testnet",
    });
  });
});

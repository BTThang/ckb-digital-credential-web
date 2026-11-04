export type BuildNetwork = "testnet" | "mainnet";

export interface BuildInfo {
  name: string;
  version: string;
  commit: string | null;
  builtAt: string | null;
  environment: string;
  network: BuildNetwork;
}

export interface BuildInfoManifest {
  name?: unknown;
  version?: unknown;
  commit?: unknown;
  builtAt?: unknown;
  environment?: unknown;
}

export interface BuildInfoInputs {
  manifest: BuildInfoManifest | null;
  packageJson: { name?: unknown; version?: unknown };
  env: Record<string, string | undefined>;
  network: BuildNetwork;
}

const DEFAULT_NAME = "ckb-digital-credential-web";
const DEFAULT_VERSION = "0.0.0";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function resolveBuildInfo({
  manifest,
  packageJson,
  env,
  network,
}: BuildInfoInputs): BuildInfo {
  return {
    name: text(manifest?.name) ?? text(packageJson.name) ?? DEFAULT_NAME,
    version:
      text(manifest?.version) ?? text(packageJson.version) ?? DEFAULT_VERSION,
    commit:
      text(manifest?.commit) ??
      text(env.VERCEL_GIT_COMMIT_SHA) ??
      text(env.GIT_COMMIT_SHA) ??
      text(env.GITHUB_SHA),
    builtAt: text(manifest?.builtAt),
    environment:
      text(manifest?.environment) ??
      text(env.VERCEL_ENV) ??
      text(env.NODE_ENV) ??
      "development",
    network,
  };
}

import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  resolveBuildInfo,
  type BuildInfo,
  type BuildNetwork,
} from "./src/config/build-info";

function text(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function gitCommit(): string | null {
  try {
    return text(
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

function readPackageJson(): { name?: unknown; version?: unknown } {
  try {
    return JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { name?: unknown; version?: unknown };
  } catch {
    return {};
  }
}

function collectBuildInfo(
  mode: string,
  env: Record<string, string>,
): BuildInfo {
  const network: BuildNetwork =
    env.VITE_CKB_NETWORK === "mainnet" ? "mainnet" : "testnet";

  return resolveBuildInfo({
    manifest: {
      commit:
        text(process.env.VERCEL_GIT_COMMIT_SHA) ??
        text(process.env.GIT_COMMIT_SHA) ??
        text(process.env.GITHUB_SHA) ??
        gitCommit(),
      builtAt: text(process.env.BUILD_TIMESTAMP) ?? new Date().toISOString(),
      environment:
        text(process.env.DEPLOYMENT_ENV) ??
        text(process.env.VERCEL_ENV) ??
        text(process.env.NODE_ENV) ??
        mode,
    },
    packageJson: readPackageJson(),
    env: process.env,
    network,
  });
}

function versionMetadataPlugin(buildInfo: BuildInfo): Plugin {
  const body = `${JSON.stringify(buildInfo, null, 2)}\n`;

  return {
    name: "version-metadata",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/version.json") {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      });
    },
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { name: "app-name", content: buildInfo.name },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "app-version", content: buildInfo.version },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: {
            name: "git-commit",
            content: buildInfo.commit ?? "unavailable",
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: {
            name: "build-time",
            content: buildInfo.builtAt ?? "unavailable",
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: {
            name: "deployment-environment",
            content: buildInfo.environment,
          },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: "deployment-network", content: buildInfo.network },
          injectTo: "head",
        },
      ];
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: body,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const buildInfo = collectBuildInfo(mode, env);

  return {
    plugins: [react(), versionMetadataPlugin(buildInfo)],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      // Pinned to IPv4 rather than left on Node's default. Node resolves
      // `localhost` by family preference, so the dev server lands on `[::1]`
      // while the API binds `127.0.0.1` - and the two then stop being able to
      // reach each other. Forcing one family here keeps both on IPv4.
      host: "127.0.0.1",
      port: Number(env.VITE_PORT ?? 5173),
      strictPort: false,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT ?? 4173),
    },
    build: {
      target: "es2022",
      sourcemap: true,
      // The CCC/Spore SDK is ~230 kB gzipped on its own and is needed for any
      // write, so a warning on every build would just be noise.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            ckb: ["@ckb-ccc/ccc", "@ckb-ccc/spore", "@ckb-ccc/joy-id"],
          },
        },
      },
    },
  };
});

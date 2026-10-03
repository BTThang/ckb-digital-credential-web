import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react()],
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

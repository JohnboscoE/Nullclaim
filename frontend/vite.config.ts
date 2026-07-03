import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    tailwindcss(),
    react(),
    {
      name: "coop-coep-headers",
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          Object.entries(crossOriginHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          Object.entries(crossOriginHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  optimizeDeps: {
    exclude: [
      "@zama-fhe/sdk",
    ],
    include: ["@zama-fhe/relayer-sdk/web", "keccak", "eventemitter3", "lodash", "debug", "ms"],
  },
  server: {
    port: 3000,
    host: "127.0.0.1",
    headers: crossOriginHeaders,
  },
  preview: {
    port: 4173,
    headers: crossOriginHeaders,
  },
});
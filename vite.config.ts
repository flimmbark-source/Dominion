// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// ✅ Ensure WebCrypto exists when Vite runs in Node (fixes getRandomValues error)
import { webcrypto } from "node:crypto";

// If crypto isn't present (older Node or odd env), provide Node's WebCrypto
// This runs in the Node context that executes the Vite config.
(globalThis as any).crypto ??= webcrypto;

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});

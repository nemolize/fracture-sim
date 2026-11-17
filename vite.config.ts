import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { localServerPort } from "./port.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    rolldownOptions: {
      // The e2e tests drive the solver through the second page.
      input: { index: "index.html", harness: "harness.html" },
    },
  },
  server: {
    port: localServerPort,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
  },
  preview: {
    port: localServerPort,
    strictPort: true,
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const web = (f: string) => fileURLToPath(new URL(`./web/${f}`, import.meta.url));

export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true, rollupOptions: { input: { main: web("index.html"), explainer: web("explainer.html") } } },
  server: { port: 5174, proxy: { "^/api/": { target: "http://127.0.0.1:4747", changeOrigin: false } } },
});

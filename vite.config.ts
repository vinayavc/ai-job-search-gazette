import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5174, proxy: { "^/api/": { target: "http://127.0.0.1:4747", changeOrigin: false } } },
});

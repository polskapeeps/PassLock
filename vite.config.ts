import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  test: {
    exclude: ["dist/**", "dist-electron/**", "node_modules/**"],
  },
});

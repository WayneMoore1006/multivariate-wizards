import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "../shared") },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)] },
  },
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
});

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: ["typescript", "vite"],
    },
    ssr: "src/index.ts",
    sourcemap: false,
    target: "node20",
  },
});

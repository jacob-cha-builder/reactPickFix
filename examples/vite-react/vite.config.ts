import react from "@vitejs/plugin-react";
import { pickfix } from "@pickfix/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), pickfix()],
});

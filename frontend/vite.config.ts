import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/price": "http://localhost:3001",
      "/chain": "http://localhost:3001",
    },
  },
});

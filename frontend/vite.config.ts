import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on IPv4 + IPv6 so http://localhost works when the OS maps it to 127.0.0.1
    host: true,
    port: 5173,
    proxy: {
      // Use 127.0.0.1 (not localhost) so Node connects over IPv4; ::1 often hits EACCES on Windows.
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});

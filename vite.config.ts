import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { version } from "./package.json";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    host: true,
    port: 5173,
    // Dev-only: letterboxd.com sends no CORS headers, so in a desktop browser
    // its pages are fetched through here. The native app doesn't need this.
    proxy: {
      "/letterboxd": {
        target: "https://letterboxd.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/letterboxd/, ""),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        },
      },
    },
  },
});

import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (!env.NEON_AUTH_BASE_URL) throw new Error("Missing NEON_AUTH_BASE_URL");
  const url = new URL(env.NEON_AUTH_BASE_URL);
  url.hostname = url.hostname.replace(".neonauth.", ".");
  url.pathname = url.pathname.replace(/\/auth\/?$/, "");
  return {
    base: "/Neftaly/",
    define: {
      __NEON_URL__: JSON.stringify(url.href.replace(/\/$/, "")),
      __NEON_AUTH_URL__: JSON.stringify(env.NEON_AUTH_BASE_URL),
    },
    server: { host: "127.0.0.1" },
  };
});

import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Optional: let an env toggle which backend you want for /api
  // e.g. VITE_USE_LOCAL_API=true/false
  const useLocal = env.VITE_USE_LOCAL_API !== "false";

  const targets = {
    dashboard: {
      local: "http://localhost:8000",
      dev: env.VITE_API_BASE,
    },
  };

  const envTarget = useLocal ? targets.dashboard.local : targets.dashboard.dev;
  const rawBase = env.VITE_ROOT || "/";
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base,
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: envTarget,
          changeOrigin: true,
          secure: false, // local is http; okay for remote https too
        },

        "/health": {
          target: envTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        // multi-page entries (add others as needed)
        input: {
          index: "./index.html",
          dashboard: "./dashboard.html",
          downloads: "./downloads.html",
          account: "./account.html",
          docs: "./docs.html",
          plans: "./plans.html",
          credits: "./credits.html",
          billing: "./billing.html",
        },
      },
    },
  };
});

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Optional: let an env toggle which backend you want for /api
  // e.g. VITE_USE_LOCAL_API=true/false
  const useLocal = env.VITE_USE_LOCAL_API !== 'false';

  const targets = {
    dashboard: {
        local: 'http://localhost:8000',
        dev: 'https://jeyfs1x61h.execute-api.us-east-1.amazonaws.com/dev',
    },
    userService: {
        local: 'http://localhost:8002',
        dev: 'https://7s5gtx7gh8.execute-api.us-east-1.amazonaws.com/dev',
    }
  };

  const envTarget = useLocal ? targets.dashboard.local : targets.dashboard.dev;

  return {
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: envTarget,
          changeOrigin: true,
          secure: false, // local is http; okay for remote https too
          // Path is already '/api/...' on both targets, so no rewrite needed.
          // If your remote didn't include '/api' in its base, you'd rewrite here.
        },

        '/health': {
          target: envTarget,
          changeOrigin: true,
          secure: false
        },

        // --- Optional: second backend you can hit in dev with a different prefix ---
        // Example: fetch('/ext/api/me') → forwards to remote /api/me
        '/user': {
          target: targets.userService.dev,
          changeOrigin: true,
          secure: true,
          // rewrite: p => p.replace(/^\/ext/, '') // '/ext/api/me' → '/api/me'
        },
      },
    },
    build: {
      rollupOptions: {
        // multi-page entries (add others as needed)
        input: {
          index: './index.html',
          dashboard: './dashboard.html',
          downloads: './downloads.html',
          account: './account.html',
          docs: './docs.html',
          plans: './plans.html',
          credits: './credits.html',
          billing: './billing.html',
      },
    },
    }
  };
});

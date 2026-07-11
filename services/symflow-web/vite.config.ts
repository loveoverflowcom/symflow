import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    fs: {
      allow: [workspaceRoot]
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
      usePolling: true,
      interval: 1000
    },
    proxy: {
      // REST endpoints
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        // ws: true is intentionally omitted here — Vite's own HMR websocket
        // must not be intercepted by this proxy. The app's websocket routes
        // (/api/runs/:id/logs) are handled by the browser connecting directly
        // to the backend once the upgrade handshake URL is known.
        configure(proxy) {
          // Suppress EPIPE noise when the backend closes the connection
          // before Vite finishes forwarding the response (e.g. backend not
          // running, or client navigated away mid-stream).
          proxy.on('error', (err, _req, _res) => {
            if ((err as NodeJS.ErrnoException).code === 'EPIPE') return;
            console.error('[proxy error]', err.message);
          });
        }
      },
      // WebSocket upgrade for app-level WS endpoints (/api/runs/:id/logs)
      '/api/runs': {
        target: 'ws://127.0.0.1:8787',
        ws: true,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (err) => {
            if ((err as NodeJS.ErrnoException).code === 'EPIPE') return;
            console.error('[ws proxy error]', err.message);
          });
        }
      }
    }
  }
});

import { defineConfig, type Plugin } from 'vite';
import { createApi } from './server/api.mjs'; // plain JS, shared with the production server

/** In dev the prize API runs inside the Vite server, so `npm run dev` is all you need. */
function tarotApi(): Plugin {
  return {
    name: 'tarot-api',
    configureServer(server) {
      const api = createApi({ dev: true, log: (m: string) => server.config.logger.info(m) });
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes('/api/')) void api(req, res);
        else next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  // PORT lets a launcher move the dev server when 5173 is taken.
  server: { host: true, port: Number(process.env.PORT) || 5173 },
  plugins: [tarotApi()],
  build: {
    rolldownOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
});

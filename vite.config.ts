import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // PORT lets a launcher move the dev server when 5173 is taken.
  server: { host: true, port: Number(process.env.PORT) || 5173 },
});

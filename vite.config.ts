import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 3030,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
});

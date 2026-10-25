import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true },
      '/ws': { target: process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8080', ws: true, changeOrigin: true },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});

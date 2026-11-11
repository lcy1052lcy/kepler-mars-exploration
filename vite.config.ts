import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project URLs use /repository-name/; set VITE_BASE_PATH at build time.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return { plugins: [react()], base: env.VITE_BASE_PATH || '/' };
});

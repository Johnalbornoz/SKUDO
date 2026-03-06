import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // VITE_GEMINI_API_KEY se expone automáticamente vía import.meta.env (sin hardcodear)
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        timeout: 120000,
      },
      },
    },
  };
});

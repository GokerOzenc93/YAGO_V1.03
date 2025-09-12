import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import solid from 'vite-plugin-solid';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), solid()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react', 'opencascade.js'],
  },
  build: {
    rollupOptions: {
      external: ['opencascade.js']
    }
  }
});

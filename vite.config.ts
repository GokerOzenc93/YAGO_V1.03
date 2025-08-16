import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Sunucunun Cross-Origin-Opener-Policy ve Cross-Origin-Embedder-Policy
  // başlıklarını ayarlamasını sağlayarak OpenCascade.js'in çoklu iş parçacığı
  // özelliğinin (multi-threading) çalışması için gereklidir.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});

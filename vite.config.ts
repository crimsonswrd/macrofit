import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/node_modules/modelence/') || id.includes('/node_modules/@modelence/')) {
            return 'modelence-vendor';
          }
          if (id.includes('/node_modules/@tanstack/')) return 'data-vendor';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (id.includes('/node_modules/@base-ui/')) return 'ui-vendor';
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          return 'vendor';
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true
  }
});

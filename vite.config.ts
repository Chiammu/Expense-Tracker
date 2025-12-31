
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: ['@google/genai'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts', 'jspdf', 'jspdf-autotable', '@supabase/supabase-js']
        }
      }
    }
  }
});

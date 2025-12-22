
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
  },
  define: {
    // API Keys configuration
    'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || ""),
    'process.env.SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ""),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ""),
    
    // Mock global process for library compatibility
    'process.version': JSON.stringify('1.0.0'),
    'process.platform': JSON.stringify('browser')
  }
});

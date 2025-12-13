import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['@google/genai'],
    }
  },
  define: {
    // 1. Tries to use the Vercel Environment Variable (secure way)
    // 2. Falls back to your hardcoded key (guaranteed to work way)
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "AlzaSyAJ4DskH1JQpRgWJkcO5jyPXYJ6Cuha7mc")
  }
});
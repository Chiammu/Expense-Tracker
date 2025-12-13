import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Critical: This tells Vite that @google/genai is loaded via CDN (index.html), 
      // so it shouldn't try to find it in node_modules during build.
      external: ['@google/genai'],
    }
  },
  define: {
    // This injects the API key from Vercel's environment variables into the code at build time.
    'process.env': process.env
  }
});
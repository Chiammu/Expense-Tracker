import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000, // Increased limit to suppress warnings
    rollupOptions: {
      external: ['@google/genai'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts', 'jspdf', 'jspdf-autotable']
        }
      }
    }
  },
  define: {
    // IMPORTANT: We map the Vercel Environment Variable 'GEMINI_API_KEY' to the internal 'process.env.API_KEY'.
    // We removed the hardcoded fallback string because it was likely an invalid key causing the 400 error.
    'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_API_KEY || ""),
    
    // Mock global process for library compatibility
    'process.version': JSON.stringify('1.0.0'),
    'process.versions': JSON.stringify({}),
    'process.platform': JSON.stringify('browser'),
    'process.env': {} 
  }
});
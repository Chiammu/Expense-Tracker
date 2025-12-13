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
    // FIXED: Changed 'Alza' (with an L) to 'AIza' (with an I)
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "AIzaSyAJ4DskH1JQpRgWJkcO5jyPXYJ6Cuha7mc"),
    // Mock the global process object
    'process.version': JSON.stringify('1.0.0'),
    'process.versions': JSON.stringify({}),
    'process.platform': JSON.stringify('browser'),
    'process.env': {} 
  }
});
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
    // Inject the API Key specifically
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "AlzaSyAJ4DskH1JQpRgWJkcO5jyPXYJ6Cuha7mc"),
    // Mock the global process object to support libraries that expect it (like some SDK builds)
    // We exclude 'env' here because vite handles process.env automatically or via the line above
    'process.version': JSON.stringify('1.0.0'),
    'process.versions': JSON.stringify({}),
    'process.platform': JSON.stringify('browser'),
    'process.env': {} 
  }
});
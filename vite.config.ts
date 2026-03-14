/**
 * Vite config optimized for FCP (First Contentful Paint)
 * 
 * This is equivalent to Next.js optimizations but for Vite:
 * - Manual chunks for code splitting
 * - Preload critical assets
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Use esbuild minification (default, faster than terser)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Manual chunking to separate large dependencies
        manualChunks: {
          // PDF.js is huge - lazy load it
          'pdf': ['pdfjs-dist'],
          // Recharts is ~150KB - lazy loaded already
          'charts': ['recharts'],
          // AI SDKs - lazy loaded
          'ai': ['@google/generative-ai'],
          // QR code - lazy loaded
          'qr': ['qrcode', 'jsqr'],
          // UI animation
          'motion': ['framer-motion'],
        },
      },
    },
    // Improve chunking
    chunkSizeWarningLimit: 500,
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['pdfjs-dist'],
  },
});

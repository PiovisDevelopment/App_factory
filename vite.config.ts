/**
 * B004 - vite.config.ts
 * =====================
 * Vite build configuration for Tauri application.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@context': path.resolve(__dirname, './src/context'),
      '@config': path.resolve(__dirname, './config'),
    },
  },

  // Development server configuration
  server: {
    port: 1420,
    strictPort: true,
    // Tauri expects a fixed port
    host: '127.0.0.1',
  },

  // Build configuration
  build: {
    target: 'esnext',
    outDir: 'dist',
    // Tauri handles minification
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Environment variable handling
  envPrefix: ['VITE_', 'TAURI_'],

  // Clear screen during dev
  clearScreen: false,
});

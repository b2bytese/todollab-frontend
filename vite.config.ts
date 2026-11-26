import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }

          if (
            normalizedId.includes('/node_modules/@tanstack/') ||
            normalizedId.includes('/node_modules/axios/') ||
            normalizedId.includes('/node_modules/zustand/')
          ) {
            return 'vendor-query';
          }

          if (normalizedId.includes('/node_modules/@dnd-kit/')) {
            return 'vendor-dnd';
          }

          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }

          if (normalizedId.includes('/node_modules/@stomp/stompjs/')) {
            return 'vendor-stomp';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});

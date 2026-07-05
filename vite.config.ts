import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    // Configure preview server for SPA routing
    host: true,
  },
});

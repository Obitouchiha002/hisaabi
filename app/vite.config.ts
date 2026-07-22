import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Website pe app /app/ pe chalti hai; Capacitor (Android) me file:// se load hoti hai
  // isliye wahan relative base chahiye.
  base: process.env.CAP_BUILD ? './' : '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    // engine app folder ke bahar hai, isliye access allow karna padta hai
    fs: { allow: ['..'] },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});

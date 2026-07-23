import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Android me app `file://` se load hoti hai, isliye `/api/ai` jaisa rasta
 * `file:///api/ai` ban jata tha — AI aur email login dono chup-chaap fail hote
 * the. APK me AI kabhi chala hi nahi. Wahan poora URL chahiye.
 *
 * Web pe khali rehta hai (same-origin), taki har preview deploy apne hi server
 * se baat kare, production se nahi.
 */
const API_BASE = process.env.VITE_API_BASE
  ?? (process.env.CAP_BUILD ? 'https://hisaabii.vercel.app' : '');

export default defineConfig({
  // Website pe app /app/ pe chalti hai; Capacitor (Android) me file:// se load hoti hai
  // isliye wahan relative base chahiye.
  base: process.env.CAP_BUILD ? './' : '/app/',
  define: { 'import.meta.env.VITE_API_BASE': JSON.stringify(API_BASE) },
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

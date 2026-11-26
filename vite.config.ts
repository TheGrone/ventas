import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Para GitHub Pages: usa './' para que funcione tanto en dominio propio como en /<repo>/
  base: './',
});

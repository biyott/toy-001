import { defineConfig } from 'vite';
export default defineConfig({build:{outDir:'artifacts/p0-performance',emptyOutDir:true,rollupOptions:{input:'tests/performance.html'}}});

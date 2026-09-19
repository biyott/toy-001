import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'artifacts/verification-build',emptyOutDir:true,rollupOptions:{input:['tests/performance.html','tests/character-preview.html','tests/boss-preview.html']}}});

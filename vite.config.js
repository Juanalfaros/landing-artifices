// vite.config.js
import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';

export default defineConfig({
  root: 'src',
  publicDir: path.resolve(__dirname, 'public'), // <- IMPORTANTE
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [
    createHtmlPlugin({ minify: true }),
    viteStaticCopy({
      targets: [
        { src: 'assets/**/*', dest: 'assets' },
        // Solo por si acaso: asegura que las legales se copian
        { src: '../public/pages/*.html', dest: 'pages' }
      ]
    })
  ],
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, 'src/assets')
    }
  }
});

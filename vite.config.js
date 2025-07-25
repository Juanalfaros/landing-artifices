import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';

export default defineConfig({
  root: 'src',
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          VITE_RECAPTCHA_SITE_KEY: process.env.VITE_RECAPTCHA_SITE_KEY
        }
      }
    }),
    viteStaticCopy({
      targets: [
        { src: 'assets/**/*', dest: 'assets' },
        { src: 'css/**/*', dest: 'css' },                // <- copia CSS sin hash
        { src: '../public/pages/*.html', dest: 'pages' } // <- por si acaso
      ]
    })
  ],
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, 'src/assets')
    }
  }
});

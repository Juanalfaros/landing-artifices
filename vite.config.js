// vite.config.js
import { defineConfig }   from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path               from 'node:path';

export default defineConfig({
  // 1️⃣ El código fuente vive en /src
  root: 'src',

  // 2️⃣ Los assets “públicos” (que NO procesas) viven en /public
  publicDir: path.resolve(__dirname, 'public'),

  // 3️⃣ El build queda fuera del proyecto, en /dist
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

  plugins: [
    /* HTML plugin (GTM + reCAPTCHA) */
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          gtmHead: `
<!-- Google Tag Manager -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
 new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
 j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${process.env.VITE_GTM_ID}');
</script>
<!-- End Google Tag Manager -->
          `,
          gtmBody: `
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${process.env.VITE_GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End GTM (noscript) -->
          `,
          VITE_RECAPTCHA_SITE_KEY: process.env.VITE_RECAPTCHA_SITE_KEY,
        },
      },
    }),

    /* Copiar sólo assets (NUNCA .html sueltos) */
    viteStaticCopy({
      targets: [
        { src: 'assets/**/*',           dest: 'assets' },
        { src: 'assets/brands/**/*',    dest: 'assets/brands' },
        { src: 'css/**/*',              dest: 'css' },
        // Excluimos cualquier .html
        {
          src: '../public/**/*',
          dest: '',
          filter: (p) => !p.endsWith('.html'),
        },
      ],
    }),
  ],

  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
  },
});

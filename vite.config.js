
// vite.config.js
import { defineConfig }      from 'vite';
import { createHtmlPlugin }  from 'vite-plugin-html';
import { viteStaticCopy }    from 'vite-plugin-static-copy';
import path                  from 'node:path';

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
          /* ——— Google Tag Manager ——— */
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

          /* ——— reCAPTCHA v3 ——— */
          // Opción B – solo la clave (por si la usas como %VITE_RECAPTCHA_SITE_KEY%):
          VITE_RECAPTCHA_SITE_KEY: process.env.VITE_RECAPTCHA_SITE_KEY
        }
      }
    }),

    /* Copiamos assets y CSS tal cual */
    viteStaticCopy({
      targets: [
        { src: 'assets/**/*',            dest: 'assets' },
        { src: 'css/**/*',               dest: 'css'    },
        { src: '../public/pages/*.html', dest: 'pages'  }
      ]
    })
  ],

  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, 'src/assets')
    }
  }
});

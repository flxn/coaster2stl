/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import apiPlugin from './vite/api-plugin.ts';
import sitePlugin from './vite/site-plugin.ts';
import siteConfig from './src/site.config.ts';
import faq from './src/tool/faq.ts';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [vue(), tailwindcss(), apiPlugin(), sitePlugin({ site: siteConfig, faq, version: packageJson.version })],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  server: {
    port: 8080,
  },
  build: {
    // three.js alone is ~700 kB minified
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      // the app, and the moderation page (/admin, served by server/index.ts)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'vue', test: /node_modules[\\/](@vue|vue|vue-i18n|@intlify)[\\/]/ },
          ],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});

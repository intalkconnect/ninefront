// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// permite subdomínios .dkdevs.com.br no dev/preview
const allowed = ['.dkdevs.com.br']

export default defineConfig({
  // 👇 multipage: não use 'spa' aqui
  // appType: 'mpa', // (opcional) explicitamente MPA
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/basic-setup',
      '@codemirror/lang-javascript',
      '@codemirror/theme-one-dark',
    ],
  },
  build: {
    // 👇 entradas HTML
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        wa:   resolve(__dirname, 'wa-embed.html'),
      },
    },
    commonjsOptions: { include: [/node_modules/] },
  },
  server: {
    host: true,
    allowedHosts: allowed,
  },
  preview: {
    host: true,
    port: 8082,
    strictPort: true,
    allowedHosts: allowed,
  },
  css: { modules: true },
})

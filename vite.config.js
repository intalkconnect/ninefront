// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ajuste: libere o(s) host(s) que vai usar em produção
const allowed = ['.dkdevs.com.br'] // permite hmg.dkdevs.com.br, foo.dkdevs.com.br, etc.

export default defineConfig({
  appType: 'spa',                   // fallback de SPA
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
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  // server dev (se usar `vite dev`)
  server: {
    host: true,                     // escuta em 0.0.0.0
    allowedHosts: allowed,          // libera seus subdomínios
    // port: 5173,                  // (opcional) porta do dev server
  },
  // server de preview (o que você usa no container)
  preview: {
    host: true,
    port: 8082,                     // mesma porta do docker-compose
    strictPort: true,               // falha se 8082 estiver ocupada
    allowedHosts: allowed,
  },
  css: { modules: true },
})

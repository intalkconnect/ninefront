import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin(), // chame como função diretamente
  ],
  server: {
    historyApiFallback: true,
  },
  css: {
    modules: true,
  },
});

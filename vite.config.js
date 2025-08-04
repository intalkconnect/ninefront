import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPluginCjs from 'vite-plugin-monaco-editor';

const { monacoEditorPlugin } = monacoEditorPluginCjs;

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['javascript'], // pode adicionar 'json', 'typescript' etc se quiser
    }),
  ],
  server: {
    historyApiFallback: true,
  },
  css: {
    modules: true,
  },
});

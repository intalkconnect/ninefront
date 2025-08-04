import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@codemirror/state': path.resolve(__dirname, 'node_modules/@codemirror/state'),
      '@codemirror/view': path.resolve(__dirname, 'node_modules/@codemirror/view'),
      '@codemirror/basic-setup': path.resolve(__dirname, 'node_modules/@codemirror/basic-setup'),
      '@codemirror/lang-javascript': path.resolve(__dirname, 'node_modules/@codemirror/lang-javascript'),
      '@codemirror/theme-one-dark': path.resolve(__dirname, 'node_modules/@codemirror/theme-one-dark'),
    },
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/basic-setup',
      '@codemirror/lang-javascript',
      '@codemirror/theme-one-dark',
    ],
  },
    server: { historyApiFallback: true },
  css: { modules: true },
});

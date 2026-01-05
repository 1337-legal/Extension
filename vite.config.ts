import path from 'path';
import {defineConfig} from 'vite';

import webExtension from '@samrum/vite-plugin-web-extension';
import tailwindcss from '@tailwindcss/vite';

import react from '@vitejs/plugin-react';
import {getManifest} from './src/manifest';

export default defineConfig(() => {
  return {
    plugins: [
        react(),
      webExtension({
        manifest: getManifest(),
      }) as any,
      tailwindcss()
    ],
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "./src"),
        "@": path.resolve(__dirname, "./src")
      },
    },
  };
});
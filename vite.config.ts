import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const plugins: PluginOption[] = [tailwindcss()];
  
  // Conditionally add react plugin and singlefile plugin
  if (command === 'build') {
    plugins.push(react());
    plugins.push(viteSingleFile());
  } else {
    plugins.push(react());
  }

  return {
    plugins,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: './', // Добавлен базовый путь для локальных файлов
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      },
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

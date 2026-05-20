import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import strip from '@rollup/plugin-strip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
  ],

  resolve: {
    alias: {
      '@dailyways/collab-protocol': path.resolve(__dirname, 'packages/collab-protocol/src/index.js'),
    },
  },

  // 🌐 Config do servidor (resolve o erro de host bloqueado)
  server: {
    host: true,
    allowedHosts: ['dailyways.saygabbis.cloud'],
    port: 5174,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:2525',
        ws: true,
      },
    },
  },

  // ⚠️ IMPORTANTE: raiz do domínio
  base: '/',

  build: {
    sourcemap: true,

    rollupOptions: {
      plugins: [
        strip({
          include: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
          exclude: ['node_modules/**', '**/src/utils/logger.js'],
          functions: [
            'console.log',
            'console.debug',
            'console.info',
            'console.trace'
          ],
          debugger: true,
        }),
      ],
    },
  },
})
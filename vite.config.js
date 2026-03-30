import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import strip from '@rollup/plugin-strip'

export default defineConfig({
  plugins: [
    react(),
  ],

  // 🌐 Config do servidor (resolve o erro de host bloqueado)
  server: {
    host: true,
    allowedHosts: ['dailyways.saygabbis.cloud'],
    port: 5174
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
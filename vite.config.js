import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import strip from '@rollup/plugin-strip'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      plugins: [
        strip({
          include: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
          exclude: ['node_modules/**', '**/src/utils/logger.js'],
          functions: ['console.log', 'console.debug', 'console.info', 'console.trace'],
          debugger: true,
          sourceMap: true,
        }),
      ],
    },
  },
})

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import strip from '@rollup/plugin-strip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Lê PORT de server/collab-server/.env para o proxy bater com o collab local. */
function getCollabPort() {
  const envPath = path.resolve(__dirname, 'server/collab-server/.env')
  try {
    const match = fs.readFileSync(envPath, 'utf8').match(/^PORT\s*=\s*(\d+)/m)
    if (match) return Number(match[1])
  } catch {
    /* ignore */
  }
  return 2529
}

const collabPort = getCollabPort()
const collabTarget = `http://127.0.0.1:${collabPort}`

export default defineConfig({
  envDir: __dirname,
  plugins: [
    react(),
  ],

  define: {
    'import.meta.env.VITE_COLLAB_DEV_PORT': JSON.stringify(String(collabPort)),
  },

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
        target: collabTarget,
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
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createLogger, defineConfig } from 'vite'
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

/** Evita spam no terminal quando o collab reinicia ou abas antigas fecham o WS. */
const devLogger = createLogger('info', { allowClearScreen: true })
const logError = devLogger.error.bind(devLogger)
devLogger.error = (msg, options) => {
  const text = typeof msg === 'string' ? msg : String(msg ?? '')
  if (
    text.includes('ECONNRESET')
    || text.includes('EPIPE')
    || text.includes('ws proxy error')
    || text.includes('ws proxy socket error')
  ) {
    return
  }
  logError(msg, options)
}

const socketIoProxy = {
  '/socket.io': {
    target: collabTarget,
    ws: true,
    configure: (proxy) => {
      const ignore = (err) => err?.code === 'ECONNRESET' || err?.code === 'EPIPE'
      proxy.on('error', (err, _req, res) => {
        if (ignore(err)) return
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502)
          res.end()
        }
      })
      proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
        socket?.on?.('error', (err) => {
          if (ignore(err)) return
        })
      })
    },
  },
}

export default defineConfig({
  customLogger: devLogger,
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
    proxy: socketIoProxy,
  },

  /** start:vps — mesma porta e proxy que dev */
  preview: {
    host: true,
    allowedHosts: ['dailyways.saygabbis.cloud'],
    port: 5174,
    proxy: socketIoProxy,
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
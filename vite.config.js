import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createLogger, defineConfig, loadEnv } from 'vite'
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

/** Origem http(s) e ws(s) de uma URL do .env (Supabase próprio, collab em outro host…). */
function connectOrigins(url) {
  try {
    const u = new URL(url)
    const ws = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return [u.origin, `${ws}//${u.host}`]
  } catch {
    return []
  }
}

/**
 * Cabeçalhos de segurança lidos de public/_headers (fonte única, também usada por Netlify & cia).
 * O `vite preview` (produção na VPS) passa a enviá-los. A CSP é APLICADA; o connect-src ganha o
 * Supabase e o collab configurados no .env (sem regra fixa de domínio).
 * DW_CSP_REPORT_ONLY=1 volta para só avisar no console.
 */
function getSecurityHeaders(env = {}) {
  const headers = {}
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, 'public/_headers'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/)
      if (m) headers[m[1]] = m[2].trim()
    }
  } catch {
    /* sem _headers → sem cabeçalhos extras */
  }
  let csp = headers['Content-Security-Policy']
  if (csp) {
    const extra = [env.VITE_SUPABASE_URL, env.VITE_COLLAB_SERVER_URL]
      .filter((v) => v && /^https?:/.test(v))
      .flatMap(connectOrigins)
    if (extra.length) csp = csp.replace('connect-src ', `connect-src ${[...new Set(extra)].join(' ')} `)
    // imagens do Storage vêm do Supabase do .env (em http no Supabase local / testes)
    const supaOrigin = connectOrigins(env.VITE_SUPABASE_URL || '')[0]
    if (supaOrigin?.startsWith('http:')) csp = csp.replace('img-src ', `img-src ${supaOrigin} `)
    headers['Content-Security-Policy'] = csp
    if (process.env.DW_CSP_REPORT_ONLY === '1') {
      delete headers['Content-Security-Policy']
      headers['Content-Security-Policy-Report-Only'] = csp
    }
  }
  return headers
}

/** Separa as libs grandes em chunks próprios (cache melhor entre deploys). */
function vendorChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
  if (id.includes('@supabase')) return 'vendor-supabase'
  if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket'
  if (id.includes('@hello-pangea')) return 'vendor-dnd'
  if (id.includes('lucide-react')) return 'vendor-icons'
  if (id.includes('date-fns')) return 'vendor-date'
  return undefined
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

export default defineConfig(({ mode }) => ({
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
    headers: getSecurityHeaders({ ...loadEnv(mode, __dirname, 'VITE_'), ...process.env }),
  },

  test: {
    include: ['src/**/*.test.{js,jsx}', 'supabase/tests/**/*.test.js'],
    environment: 'node',
  },

  // ⚠️ IMPORTANTE: raiz do domínio
  base: '/',

  build: {
    // Sourcemaps públicos expõem o código-fonte inteiro; só gera se pedir (DW_SOURCEMAP=1).
    sourcemap: process.env.DW_SOURCEMAP === '1',

    rollupOptions: {
      output: { manualChunks: vendorChunk },
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
}))

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), ''),
    ...loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), ''),
  }
  return {
  plugins: [react(), tailwindcss(), sampleEntry(), spaFallback()],
  server: {
    port: 5175,
    proxy: {
      '/api/spot': {
        target: 'https://forex-data-feed.swissquote.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spot/, ''),
      },
      '/api/fx': {
        target: 'https://open.er-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fx/, ''),
      },
      '/api/gold': {
        target: 'https://www.goldapi.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gold/, '/api'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const raw = req.headers['x-gold-key']
            const headerKey = Array.isArray(raw) ? raw[0] : raw
            const key = headerKey?.trim() || env.GOLD_API_KEY
            if (key) proxyReq.setHeader('x-access-token', key)
            proxyReq.removeHeader('x-gold-key')
          })
        },
      },
    },
  },
  resolve: {
    alias: {
      '@goldflow/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@goldflow/ui-tokens': fileURLToPath(new URL('../../packages/ui-tokens/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}
})

function sampleEntry() {
  return {
    name: 'sample-entry',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path === '/sample' || path === '/sample/') {
          res.statusCode = 302
          res.setHeader('Location', '/sample/index.html')
          res.end()
          return
        }
        next()
      })
    },
  }
}

function spaFallback() {
  return {
    name: 'spa-fallback',
    apply: 'build' as const,
    closeBundle() {
      const index = fileURLToPath(new URL('./dist/index.html', import.meta.url))
      copyFileSync(index, fileURLToPath(new URL('./dist/404.html', import.meta.url)))
    },
  }
}

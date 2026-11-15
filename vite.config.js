import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Runs the Vercel functions from /api inside `npm run dev`, so the whole app
// (login, history, health check) can be tested locally before pushing.
// Secrets are read from .env.local, which is never committed.
const localApi = () => ({
  name: 'local-api',
  configureServer(server) {
    Object.assign(process.env, loadEnv('development', process.cwd(), ''))

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, `http://${req.headers.host}`)

      if (!/^\/api\/[\w/-]+$/.test(url.pathname) || url.pathname.includes('/_')) {
        return next()
      }

      const file = path.join(process.cwd(), `${url.pathname}.js`)

      if (!existsSync(file)) {
        return next()
      }

      try {
        const chunks = []

        for await (const chunk of req) {
          chunks.push(chunk)
        }

        const handler = (await import(pathToFileURL(file).href)).default
        const response = await handler.fetch(new Request(url, {
          method: req.method,
          headers: req.headers,
          body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
        }))

        res.statusCode = response.status
        response.headers.forEach((value, key) => {
          if (key !== 'set-cookie') {
            res.setHeader(key, value)
          }
        })

        const cookies = response.headers.getSetCookie()

        if (cookies.length > 0) {
          res.setHeader('set-cookie', cookies)
        }

        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (error) {
        console.error('Local API failed', error)
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: error.message }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    localApi(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      workbox: {
        // Never let the offline cache answer for the API.
        navigateFallbackDenylist: [/^\/api\//]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'V60 Tetsu Kasuya 4:6 Timer',
        short_name: 'V60 Timer',
        description: 'Tetsu Kasuya 4:6 Method Coffee Timer',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true // Expose to LAN
  }
})

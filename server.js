import express from 'express'
import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })
const publicDir = path.join(__dirname, 'public')
const statusPath = path.join(__dirname, 'runtime', 'status.json')
const packageInfo = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'))
const commandMetadata = JSON.parse(await fs.readFile(path.join(publicDir, 'commands.json'), 'utf8'))
const app = express()
const requestWindowMs = 60_000
const requestLimit = 300
const ipRequests = new Map()
const heartbeatExpiryMs = 30_000

app.disable('x-powered-by')
app.set('trust proxy', false)
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  })
  next()
})

const apiRateLimit = (req, res, next) => {
  const now = Date.now()
  const key = req.socket.remoteAddress || 'unknown'
  const record = ipRequests.get(key)
  const current = !record || now - record.startedAt >= requestWindowMs
    ? { startedAt: now, count: 0 }
    : record
  current.count += 1
  ipRequests.set(key, current)
  if (current.count > requestLimit) {
    res.set('Retry-After', '60').status(429).json({ error: 'Zu viele Anfragen. Bitte warte einen Moment.' })
    return
  }
  next()
}

const readPublicStatus = async () => {
  let runtimeStatus = null
  try {
    runtimeStatus = JSON.parse(await fs.readFile(statusPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Botstatus konnte nicht gelesen werden:', error.message)
    }
  }

  const heartbeat = Number(runtimeStatus?.heartbeatAt)
  const heartbeatAge = Date.now() - heartbeat
  const fresh = Number.isFinite(heartbeat) && heartbeatAge >= 0 && heartbeatAge <= heartbeatExpiryMs
  const whatsapp = fresh && ['online', 'connecting', 'maintenance'].includes(runtimeStatus?.whatsapp)
    ? runtimeStatus.whatsapp
    : 'offline'

  return {
    name: 'Тишина',
    developer: 'Maxichen',
    version: packageInfo.version,
    prefix: fresh && typeof runtimeStatus.prefix === 'string' ? runtimeStatus.prefix.slice(0, 5) : '!',
    whatsapp,
    webserver: 'online',
    maintenance: fresh ? runtimeStatus?.maintenance === true : false,
    aiEnabled: fresh && runtimeStatus?.ai?.enabled === true && runtimeStatus?.ai?.configured === true,
    updatedAt: fresh ? new Date(heartbeat).toISOString() : new Date().toISOString()
  }
}

app.get('/api/*path', apiRateLimit)
app.get('/api/status', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store').json(await readPublicStatus())
  } catch (error) {
    next(error)
  }
})
app.get('/api/bot', async (_req, res, next) => {
  try {
    const status = await readPublicStatus()
    res.set('Cache-Control', 'no-store').json({
      name: status.name,
      developer: status.developer,
      version: status.version,
      prefix: status.prefix
    })
  } catch (error) {
    next(error)
  }
})
app.get('/api/version', (_req, res) => res.json({ version: packageInfo.version }))
app.get('/api/commands', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60').json(commandMetadata)
})
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use(express.static(publicDir, {
  extensions: ['html'],
  index: 'index.html',
  dotfiles: 'deny',
  etag: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (['.html', '.js', '.css', '.json'].includes(path.extname(filePath).toLowerCase())) {
      res.setHeader('Cache-Control', 'no-cache')
    }
  }
}))

const pageRoutes = new Map([
  ['/about', 'about.html'],
  ['/commands', 'commands.html'],
  ['/status', 'status.html'],
  ['/privacy', 'privacy.html'],
  ['/imprint', 'imprint.html']
])
for (const [route, page] of pageRoutes) {
  app.get(route, (_req, res, next) => res.sendFile(path.join(publicDir, 'pages', page), (error) => {
    if (error) next(error)
  }))
}

app.use((error, _req, res, _next) => {
  console.error('Website-Anfrage fehlgeschlagen:', error.message)
  if (res.headersSent) return
  res.status(500).json({ error: 'Die Anfrage konnte gerade nicht verarbeitet werden.' })
})

const cleanupRateLimit = setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of ipRequests) {
    if (now - record.startedAt >= requestWindowMs) ipRequests.delete(ip)
  }
}, requestWindowMs)
cleanupRateLimit.unref()

const port = Number(process.env.PORT || '7777')
const host = String(process.env.HOST || 'localhost').trim() || 'localhost'
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT muss zwischen 1 und 65535 liegen.')
}

const server = app.listen(port, host, () => {
  console.log(`Тишина Website läuft unter http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(cleanupRateLimit)
    server.close((error) => {
      if (error) {
        console.error('Website konnte nicht sauber beendet werden:', error.message)
        process.exitCode = 1
      }
    })
  })
}

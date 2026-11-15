// Тишина — a quiet voice in a noisy world. By Maxichen.

import Тишина from '@neelegirly/wa-api'
import { WAMessageStubType } from '@neelegirly/baileys'
import boxen from 'boxen'
import chalk from 'chalk'
import dotenv from 'dotenv'
import QRCode from 'qrcode'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { BOT_OWNER_INFO, OWNERS } from './owner.js'
import { getDisplayMention } from './lib/group-message.js'
import { buildMessageSendOptions, sanitizeGroupPayload, sendТишина } from './lib/message-send.js'
import { buildTagAllMessage, collectTagAllMentions, isAuthorizedTagAll } from './lib/tagall.js'
import {
  buildWhatsAppCategoryMenu,
  buildWhatsAppMainMenu,
  getNextMenuCategoryId,
  MENU_CATEGORIES
} from './lib/menu.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })

const TZ = 'Europe/Berlin'
const SAVE_INTERVAL_MS = 5 * 60 * 1000
const SESSION_PREFIX = 'Тишина_'
const LEGACY_PRIMARY_SESSION_NAME = 'main-session'
const DEFAULT_SESSION_NAME = `${SESSION_PREFIX}Maxichen`
const BOOT_AT = Date.now()
const DB_FILE_PATH = path.join(__dirname, 'database.json')
const PACKAGE_FILE_PATH = path.join(__dirname, 'package.json')
const PUBLIC_COMMANDS_PATH = path.join(__dirname, 'public', 'commands.json')
const RUNTIME_STATUS_PATH = path.join(__dirname, 'runtime', 'status.json')
const DEFAULT_EVENT_BANNER_PATH = path.join(__dirname, 'docs', 'assets', 'readme-hero.jpg')
const QR_PENDING_TTL_MS = 5 * 60 * 1000
const QR_WAIT_NOTICE_MS = 15 * 1000
const MENU_SESSION_TTL_MS = 15 * 60 * 1000
const STATUS_HEARTBEAT_MS = 10 * 1000
const QR_IMAGE_WIDTH = 920
const TAGALL_COOLDOWN_MS = 60 * 1000
const BRAND_COLORS = {
  midnight: '#080B12',
  nightBlue: '#0D1420',
  darkSlate: '#151C29',
  coldGrey: '#26303C',
  steelBlue: '#526579',
  iceBlue: '#A8B8C8',
  softWhite: '#E5E9EF',
  burgundy: '#48212D',
  dustyRose: '#80515E'
}
const QR_PRIMARY_COLOR = BRAND_COLORS.nightBlue
const QR_BACKGROUND_COLOR = BRAND_COLORS.softWhite

const packageMeta = JSON.parse(fs.readFileSync(PACKAGE_FILE_PATH, 'utf-8'))
const publicCommandGroups = JSON.parse(fs.readFileSync(PUBLIC_COMMANDS_PATH, 'utf-8'))
const pendingQrTargets = new Map()
const pendingQrWaitNotices = new Map()
const menuSessions = new Map()
const tagAllCooldowns = new Map()

const DEFAULT_WELCOME_TEMPLATE = '🥀 Willkommen, @user.\n\nSchön, dass du in *@subject* angekommen bist.\n\nBeschreibung: @desc\nMitglieder: @count\nSession: @session\n\n«Иногда тишина говорит больше, чем тысяча слов.»'
const DEFAULT_GOODBYE_TEMPLATE = '🥀 @user hat *@subject* verlassen.\n\nManche Wege trennen sich leise. Wir wünschen dir alles Gute.\n\nMitglieder: @count\nSession: @session'
const DEFAULT_KICK_TEMPLATE = '🥀 @user wurde von @moderator aus *@subject* entfernt.\n\nGrund: @reason\nMitglieder: @count\nSession: @session'
const PREVIOUS_DEFAULT_TEMPLATES = {
  welcome: '🌸 Willkommen @user in *@subject*!\n\n📖 Beschreibung: @desc\n👥 Mitglieder: @count\n🤖 Session: @session',
  goodbye: '💫 Tschüss @user aus *@subject*!\n\nWir wünschen dir alles Liebe.\n👥 Mitglieder: @count\n🤖 Session: @session',
  kick: '🚫 @user wurde von @moderator aus *@subject* entfernt.\n\n🧾 Grund: @reason\n👥 Mitglieder: @count\n🤖 Session: @session'
}

const WELCOME_RANDOM_PHRASES = [
  '🥀 Willkommen, {user}. Schön, dass du jetzt hier bist.',
  'Ein neuer Anfang in einer stillen Nacht: Willkommen, {user}.',
  'Willkommen, {user}. Möge dieser Ort sich ein wenig wie Zuhause anfühlen.',
  'Привет, {user}. Schön, dass du deinen Weg zu uns gefunden hast.',
  'Manchmal beginnt etwas Gutes ganz leise. Willkommen, {user}.'
]

const LEAVE_RANDOM_PHRASES = [
  '🥀 {user} ist weitergezogen. Möge der nächste Weg freundlich sein.',
  'Auf Wiedersehen, {user}. Vielleicht kreuzen sich unsere Wege wieder.',
  '{user} hat diesen Ort verlassen. Ein leiser Abschied.',
  'Manche Wege führen auseinander. Alles Gute, {user}.'
]

const KICK_RANDOM_PHRASES = [
  '🥀 {user} wurde aus der Gruppe entfernt.',
  '{user} kann vorerst nicht Teil dieser Gruppe sein.',
  'Die Gruppenregeln wurden durchgesetzt: {user} wurde entfernt.',
  'Ein schwieriger Schritt: {user} wurde aus der Gruppe entfernt.'
]

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'ja', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'nein', 'off'].includes(normalized)) return false
  return fallback
}

const parseInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const splitCommaList = (value) => String(value ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)

const unique = (values = []) => [...new Set(values.filter(Boolean))]

const extractDigits = (value = '') => String(value ?? '').replace(/\D/g, '')

const normalizeJid = (value = '') => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.includes('@')) return raw
  const digits = extractDigits(raw)
  return digits ? `${digits}@s.whatsapp.net` : raw
}

const normalizeMentionList = (participants = []) => unique(
  (Array.isArray(participants) ? participants : [participants])
    .map((entry) => {
      if (!entry) return ''
      if (typeof entry === 'string') return normalizeJid(entry)
      if (typeof entry?.id === 'string') return normalizeJid(entry.id)
      if (typeof entry?.jid === 'string') return normalizeJid(entry.jid)
      if (typeof entry?.participant === 'string') return normalizeJid(entry.participant)
      if (entry?.id && typeof entry.id === 'object' && typeof entry.id.user === 'string' && typeof entry.id.server === 'string') {
        return `${entry.id.user}@${entry.id.server}`
      }
      if (entry?.jid && typeof entry.jid === 'object' && typeof entry.jid.user === 'string' && typeof entry.jid.server === 'string') {
        return `${entry.jid.user}@${entry.jid.server}`
      }
      return ''
    })
)

const normalizeSessionName = (value = '') => {
  let name = String(value ?? '').trim()
  if (!name) throw new Error('Der Sessionname darf nicht leer sein.')
  if (name.toLowerCase() === LEGACY_PRIMARY_SESSION_NAME) name = 'Maxichen'

  while (new RegExp(`^${SESSION_PREFIX}`, 'iu').test(name)) {
    name = name.slice(SESSION_PREFIX.length)
  }
  if (name.toLowerCase() === LEGACY_PRIMARY_SESSION_NAME) name = 'Maxichen'
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(name) || name.includes('..') || name.endsWith('.')) {
    throw new Error('Ungültiger Sessionname. Erlaubt sind 1–40 Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich; Pfadangaben sind nicht erlaubt.')
  }
  return `${SESSION_PREFIX}${name}`
}

const normalizeSessionNames = (values = []) => {
  const normalized = new Map()
  for (const value of values) {
    const name = normalizeSessionName(value)
    const key = name.toLocaleLowerCase('en-US')
    if (normalized.has(key)) {
      throw new Error(`Doppelter Sessionname "${value}" kollidiert mit "${normalized.get(key)}".`)
    }
    normalized.set(key, name)
  }
  return [...normalized.values()]
}

const getCredentialRoots = () => ['Neelegirly_Sessions', 'sessions_neelegirly', 'wa_credentials']
  .map((directory) => {
    const root = path.resolve(__dirname, directory)
    try {
      const stats = fs.lstatSync(root)
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Session-Migration abgebrochen: Credential-Wurzel "${root}" ist kein normales Verzeichnis.`)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return root
  })

const getCredentialDirectories = (sessionId) => {
  const suffixes = ['_neelegirly', '_credentials_neelegirly', '_credentials']
  return [...new Set(getCredentialRoots().flatMap((root) => suffixes.map((suffix) => path.join(root, `${sessionId}${suffix}`))))]
}

const listExistingCredentialDirectories = (sessionId) => {
  const directories = []
  for (const directory of getCredentialDirectories(sessionId)) {
    try {
      const stats = fs.lstatSync(directory)
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Session-Migration abgebrochen: Credential-Pfad "${directory}" ist kein normales Verzeichnis.`)
      }
      directories.push(directory)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
  }
  return directories
}

const getCredentialTreeSnapshot = (root) => {
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      const stats = fs.lstatSync(entryPath)
      if (stats.isSymbolicLink()) throw new Error('Session-Credentials enthalten einen symbolischen Link; Migration abgebrochen.')
      if (stats.isDirectory()) visit(entryPath)
      else if (stats.isFile()) {
        files.push({
          path: path.relative(root, entryPath),
          size: stats.size,
          digest: createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex')
        })
      } else throw new Error('Session-Credentials enthalten einen nicht unterstützten Dateityp; Migration abgebrochen.')
    }
  }
  visit(root)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

const secureCredentialTree = (root) => {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      secureCredentialTree(entryPath)
      fs.chmodSync(entryPath, 0o700)
    } else if (entry.isFile()) {
      fs.chmodSync(entryPath, 0o600)
    } else {
      throw new Error('Session-Credentials enthalten einen nicht unterstützten Dateityp; Backup abgebrochen.')
    }
  }
  fs.chmodSync(root, 0o700)
}

const readSessionRegistryMigration = () => {
  const registryFile = '.neelegirly-session-registry.json'
  const plans = []
  let hasLegacyPrimary = false
  let hasCanonicalPrimary = false
  for (const root of getCredentialRoots()) {
    const filePath = path.join(root, registryFile)
    if (!fs.existsSync(filePath)) continue
    const stats = fs.lstatSync(filePath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Session-Migration abgebrochen: Ungültige wa-api-Registry-Datei unter "${root}".`)
    }

    let registry
    try {
      registry = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
      throw new Error(`Session-Migration abgebrochen: wa-api-Registry unter "${root}" ist ungültiges JSON (${error.message}).`)
    }
    if (!registry.sessions || typeof registry.sessions !== 'object' || Array.isArray(registry.sessions)) continue

    const migratedSessions = {}
    const names = new Map()
    let changed = false
    for (const [originalName, entry] of Object.entries(registry.sessions)) {
      const normalizedName = normalizeSessionName(originalName)
      if (normalizedName === DEFAULT_SESSION_NAME) {
        if (originalName === DEFAULT_SESSION_NAME) hasCanonicalPrimary = true
        else hasLegacyPrimary = true
      }
      const key = normalizedName.toLocaleLowerCase('en-US')
      if (names.has(key)) {
        throw new Error(`Session-Migration abgebrochen: Registry-Einträge "${names.get(key)}" und "${originalName}" kollidieren bei "${normalizedName}".`)
      }
      names.set(key, originalName)
      const migratedEntry = entry && typeof entry === 'object'
        ? { ...entry, id: normalizedName }
        : { id: normalizedName }
      if (migratedEntry.pm2Name === originalName) migratedEntry.pm2Name = normalizedName
      migratedSessions[normalizedName] = migratedEntry
      if (originalName !== normalizedName || entry?.id !== normalizedName) changed = true
    }
    if (changed) plans.push({ filePath, registry: { ...registry, sessions: migratedSessions } })
  }
  return { plans, hasLegacyPrimary, hasCanonicalPrimary }
}

const applySessionRegistryMigration = (plans = []) => {
  if (!plans.length) return false
  const backupDirectory = path.join(__dirname, 'runtime', 'session-backups', 'registries')
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 })
  fs.chmodSync(backupDirectory, 0o700)
  for (const plan of plans) {
    const backupPath = path.join(backupDirectory, `${path.basename(path.dirname(plan.filePath))}-${Date.now()}-${process.pid}.json`)
    fs.copyFileSync(plan.filePath, backupPath, fs.constants.COPYFILE_EXCL)
    fs.chmodSync(backupPath, 0o600)
    const temporaryPath = `${plan.filePath}.${process.pid}.tmp`
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(plan.registry, null, 2), { mode: 0o600, flag: 'wx' })
      fs.renameSync(temporaryPath, plan.filePath)
    } catch (error) {
      if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath)
      throw new Error(`wa-api-Registry konnte nicht migriert werden; Backup erhalten: ${error.message}`)
    }
  }
  return true
}

const migratePrimarySessionData = () => {
  const existingSessions = global.db.data.sessions || {}
  const migratedSessions = {}
  const originalNames = new Map()
  let registryChanged = false
  let hasLegacyPrimary = false
  let hasCanonicalPrimary = false

  for (const [originalName, entry] of Object.entries(existingSessions)) {
    const normalizedName = normalizeSessionName(originalName)
    if (normalizedName === DEFAULT_SESSION_NAME) {
      if (originalName === DEFAULT_SESSION_NAME) hasCanonicalPrimary = true
      else hasLegacyPrimary = true
    }
    const normalizedKey = normalizedName.toLocaleLowerCase('en-US')
    if (originalNames.has(normalizedKey)) {
      throw new Error(`Session-Migration abgebrochen: "${originalNames.get(normalizedKey)}" und "${originalName}" würden beide zu "${normalizedName}". Keine Sessiondaten wurden überschrieben.`)
    }
    originalNames.set(normalizedKey, originalName)
    migratedSessions[normalizedName] = {
      ...entry,
      id: normalizedName
    }
    if (originalName !== normalizedName || entry?.id !== normalizedName) registryChanged = true
  }

  const packageRegistry = readSessionRegistryMigration()
  hasLegacyPrimary ||= packageRegistry.hasLegacyPrimary
  hasCanonicalPrimary ||= packageRegistry.hasCanonicalPrimary
  const legacyCredentials = listExistingCredentialDirectories(LEGACY_PRIMARY_SESSION_NAME)
  const primaryCredentials = listExistingCredentialDirectories(DEFAULT_SESSION_NAME)
  hasLegacyPrimary ||= legacyCredentials.length > 0
  hasCanonicalPrimary ||= primaryCredentials.length > 0
  if (hasLegacyPrimary && hasCanonicalPrimary) {
    throw new Error(`Session-Migration abgebrochen: "${LEGACY_PRIMARY_SESSION_NAME}" und "${DEFAULT_SESSION_NAME}" existieren parallel in Registry oder Credentials. Alle Daten bleiben unverändert; erstelle ein Backup und löse den Konflikt manuell.`)
  }
  if (legacyCredentials.length && primaryCredentials.length) {
    throw new Error(`Session-Migration abgebrochen: Credentials für "${LEGACY_PRIMARY_SESSION_NAME}" und "${DEFAULT_SESSION_NAME}" existieren parallel. Beide bleiben unverändert; löse den Konflikt manuell nach einem Backup.`)
  }
  if (legacyCredentials.length > 1 || primaryCredentials.length > 1) {
    throw new Error('Session-Migration abgebrochen: Mehrere Credential-Verzeichnisse für die Hauptsession gefunden. Alle Dateien bleiben unverändert.')
  }

  let credentialsMigrated = false
  if (legacyCredentials.length === 1) {
    const source = legacyCredentials[0]
    const target = path.resolve(__dirname, 'Neelegirly_Sessions', `${DEFAULT_SESSION_NAME}_neelegirly`)
    const sourceSnapshot = getCredentialTreeSnapshot(source)
    if (!sourceSnapshot.length) throw new Error('Session-Migration abgebrochen: Das alte Credential-Verzeichnis ist leer.')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (fs.existsSync(target)) {
      throw new Error(`Session-Migration abgebrochen: Das Ziel "${DEFAULT_SESSION_NAME}" ist bereits vorhanden. Credentials wurden nicht überschrieben.`)
    }
    const temporaryTarget = `${target}.migration-${process.pid}`
    if (fs.existsSync(temporaryTarget)) {
      throw new Error('Session-Migration abgebrochen: Ein temporäres Zielverzeichnis ist bereits vorhanden.')
    }
    let copied = false
    let targetCreated = false
    try {
      fs.cpSync(source, temporaryTarget, { recursive: true, errorOnExist: true, force: false })
      copied = true
      const targetSnapshot = getCredentialTreeSnapshot(temporaryTarget)
      if (JSON.stringify(sourceSnapshot) !== JSON.stringify(targetSnapshot)) {
        throw new Error('Die kopierten Session-Credentials stimmen nicht vollständig überein.')
      }
      fs.renameSync(temporaryTarget, target)
      targetCreated = true
      const backupDirectory = path.join(__dirname, 'runtime', 'session-backups', 'credentials')
      fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 })
      fs.chmodSync(backupDirectory, 0o700)
      const backupPath = path.join(backupDirectory, `${path.basename(source)}-${Date.now()}-${process.pid}`)
      fs.renameSync(source, backupPath)
      secureCredentialTree(backupPath)
      credentialsMigrated = true
      console.info(`[INFO] Hauptsession-Credentials nach "${DEFAULT_SESSION_NAME}" migriert; Original in runtime/session-backups gesichert.`)
    } catch (error) {
      if (copied && fs.existsSync(temporaryTarget)) fs.rmSync(temporaryTarget, { recursive: true, force: true })
      if (targetCreated && fs.existsSync(source)) fs.rmSync(target, { recursive: true, force: true })
      throw new Error(`Session-Credential-Migration fehlgeschlagen; Quelle bleibt erhalten: ${error.message}`)
    }
  }

  const packageRegistryChanged = applySessionRegistryMigration(packageRegistry.plans)
  global.db.data.sessions = migratedSessions
  if (registryChanged) {
    global.db.data.meta.updatedAt = Date.now()
    console.info(`[INFO] Session-Registry auf das Präfix "${SESSION_PREFIX}" migriert.`)
  }
  if (packageRegistryChanged) console.info('[INFO] wa-api-Session-Registry migriert und Original gesichert.')
  return registryChanged || credentialsMigrated || packageRegistryChanged
}

const reconcilePersistedSessionStates = () => {
  const nonTerminalStates = new Set(['starting', 'connecting', 'online', 'running'])
  let changed = false
  for (const entry of Object.values(global.db.data.sessions || {})) {
    if (!nonTerminalStates.has(String(entry?.state || '').toLowerCase())) continue
    entry.state = 'offline'
    entry.updatedAt = Date.now()
    changed = true
  }
  return changed
}

const safeJsonParse = (value, fallback = null) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const buildDefaultDatabase = () => ({
  meta: {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: packageMeta.version || '0.0.0'
  },
  users: {},
  groups: {},
  sessions: {},
  settings: {
    prefix: process.env.BOT_PREFIX || '!',
    maintenance: false,
    aiEnabled: false,
    aiEnabledOverridden: false,
    aiUsage: {}
  },
  stats: {
    totalMessages: 0,
    totalCommands: 0,
    totalWelcomes: 0,
    totalGoodbyes: 0,
    totalKicks: 0,
    commandUsage: {}
  }
})

const mergeDatabaseDefaults = (data = {}) => {
  const defaults = buildDefaultDatabase()
  return {
    ...defaults,
    ...data,
    meta: {
      ...defaults.meta,
      ...(data.meta || {})
    },
    users: data.users || {},
    groups: data.groups || {},
    sessions: data.sessions || {},
    settings: {
      ...defaults.settings,
      ...(data.settings || {}),
      aiUsage: (data.settings || {}).aiUsage || {}
    },
    stats: {
      ...defaults.stats,
      ...(data.stats || {}),
      commandUsage: {
        ...defaults.stats.commandUsage,
        ...((data.stats || {}).commandUsage || {})
      }
    }
  }
}

if (!fs.existsSync(DB_FILE_PATH)) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(buildDefaultDatabase(), null, 2))
}

const adapter = new JSONFile(DB_FILE_PATH)
const db = new Low(adapter, buildDefaultDatabase())
await db.read()
db.data = mergeDatabaseDefaults(db.data)
global.db = db
if (migratePrimarySessionData()) await db.write()
if (reconcilePersistedSessionStates()) {
  await db.write()
  console.info('[INFO] Persistierte Session-Zustände beim Prozessstart auf offline zurückgesetzt; Live-Status wird durch aktuelle Verbindungsevents aktualisiert.')
}

const saveDatabase = async () => {
  global.db.data.meta.updatedAt = Date.now()
  await global.db.write()
}

const saveInterval = setInterval(() => {
  saveDatabase().catch((error) => {
    console.error('Fehler beim Speichern der Datenbank:', error)
  })
}, SAVE_INTERVAL_MS)
saveInterval.unref?.()

const normalizeOwnerNumber = (number, id) => {
  const normalized = extractDigits(number)
  if (!/^\d{10,15}$/.test(normalized)) {
    throw new Error(`Ungültige Owner-Nummer in owner.js für ID ${id}.`)
  }
  return normalized
}

if (!Array.isArray(OWNERS) || OWNERS.length !== 7) {
  throw new Error('owner.js muss genau sieben Owner-Einträge enthalten.')
}

const owners = OWNERS.map((owner) => ({
  ...owner,
  number: normalizeOwnerNumber(owner.number, owner.id)
}))

if (new Set(owners.map((owner) => owner.number)).size !== owners.length) {
  throw new Error('owner.js enthält doppelte Owner-Nummern.')
}
if (new Set(owners.map((owner) => owner.id)).size !== owners.length || owners.some((owner, index) => owner.id !== index + 1)) {
  throw new Error('owner.js muss die Owner-IDs 1 bis 7 genau einmal enthalten.')
}
if (owners.some((owner) => !owner.enabled)) {
  throw new Error('Alle sieben Owner müssen in owner.js aktiviert sein.')
}

const primaryOwner = owners.find((owner) => owner.id === 1 && owner.enabled && owner.level === 100)
if (!primaryOwner) {
  throw new Error('owner.js benötigt einen aktivierten Hauptinhaber mit ID 1 und Level 100.')
}
if (BOT_OWNER_INFO.ownerCount !== owners.length || !BOT_OWNER_INFO.website) {
  throw new Error('BOT_OWNER_INFO in owner.js ist unvollständig.')
}

const ownerNumbers = owners.filter((owner) => owner.enabled).map((owner) => `${owner.number}@s.whatsapp.net`)
const ownerConfig = {
  ownerName: BOT_OWNER_INFO.developer,
  regName: BOT_OWNER_INFO.name,
  ownerTag: '🥀 By Maxichen',
  ownerContact: BOT_OWNER_INFO.website
}

const runtimeConfig = {
  appName: String(process.env.APP_NAME || ownerConfig.regName || 'Тишина').trim() || 'Тишина',
  botPrefix: String(process.env.BOT_PREFIX || global.db.data.settings.prefix || '!').trim() || '!',
  printQR: parseBoolean(process.env.WHATSAPP_PRINT_QR, true),
  bootstrapSessions: normalizeSessionNames(splitCommaList(process.env.WA_API_BOOTSTRAP_SESSIONS)),
  retryLimit: parseInteger(process.env.WA_API_RETRY_LIMIT, 10),
  dryRun: parseBoolean(process.env['Тишина bot_DRY_RUN'], parseBoolean(process.env.ТишинаBASEV3_DRY_RUN, false)),
  ai: {
    configured: !!String(process.env.AI_PROVIDER || '').trim()
      && !!String(process.env.AI_API_KEY || '').trim()
      && !!String(process.env.AI_MODEL || '').trim(),
    provider: String(process.env.AI_PROVIDER || '').trim(),
    apiKey: String(process.env.AI_API_KEY || '').trim(),
    model: String(process.env.AI_MODEL || '').trim(),
    baseUrl: String(process.env.AI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, ''),
    dailyLimit: Math.min(100, Math.max(1, parseInteger(process.env.AI_DAILY_LIMIT, 10)))
  }
}

try {
  const aiUrl = new URL(runtimeConfig.ai.baseUrl)
  if (!['http:', 'https:'].includes(aiUrl.protocol) || aiUrl.username || aiUrl.password || aiUrl.search || aiUrl.hash) {
    throw new Error('Ungültige AI_BASE_URL.')
  }
  runtimeConfig.ai.endpoint = `${runtimeConfig.ai.baseUrl}${runtimeConfig.ai.baseUrl.endsWith('/chat/completions') ? '' : '/chat/completions'}`
} catch {
  runtimeConfig.ai.configured = false
  runtimeConfig.ai.endpoint = ''
  console.warn('AI_BASE_URL ist ungültig; die optionale KI bleibt deaktiviert.')
}

if (!global.db.data.settings.aiEnabledOverridden) {
  global.db.data.settings.aiEnabled = runtimeConfig.ai.configured && parseBoolean(process.env.AI_ENABLED, false)
}

global.db.data.settings.prefix = runtimeConfig.botPrefix

const COMMAND_ALIASES = new Map([
  ['menu', 'menu'],
  ['menü', 'menu'],
  ['help', 'help'],
  ['hilfe', 'help'],
  ['commands', 'help'],
  ['befehle', 'help'],
  ['register', 'register'],
  ['reg', 'register'],
  ['me', 'me'],
  ['profil', 'me'],
  ['profile', 'me'],
  ['ping', 'ping'],
  ['uptime', 'uptime'],
  ['alive', 'ping'],
  ['about', 'about'],
  ['info', 'about'],
  ['rules', 'rules'],
  ['regeln', 'rules'],
  ['support', 'support'],
  ['hilfe-team', 'support'],
  ['ownercontact', 'ownercontact'],
  ['prefix', 'prefix'],
  ['setprefix', 'setprefix'],
  ['changeprefix', 'setprefix'],
  ['plugins', 'plugins'],
  ['plugin', 'plugins'],
  ['stats', 'stats'],
  ['runtime', 'stats'],
  ['status', 'status'],
  ['version', 'version'],
  ['website', 'website'],
  ['quote', 'quote'],
  ['random', 'random'],
  ['fact', 'fact'],
  ['ai', 'ai'],
  ['groupinfo', 'groupinfo'],
  ['gruppeninfo', 'groupinfo'],
  ['addmeta', 'addmeta'],
  ['kickmeta', 'kickmeta'],
  ['owner', 'owner'],
  ['ownerlist', 'ownerlist'],
  ['botinfo', 'botinfo'],
  ['botstatus', 'botstatus'],
  ['maintenance', 'maintenance'],
  ['logs', 'logs'],
  ['restart', 'restart'],
  ['tagall', 'tagall'],
  ['hidetag', 'tagall'],
  ['welcome', 'welcome'],
  ['setwelcome', 'welcome'],
  ['session-info', 'session-info'],
  ['sessioninfo', 'session-info'],
  ['sessions', 'sessions'],
  ['session-start', 'session-start'],
  ['sessionstart', 'session-start'],
  ['startsession', 'session-start'],
  ['session-pair', 'session-pair'],
  ['sessionpair', 'session-pair'],
  ['pairsession', 'session-pair'],
  ['session-pause', 'session-pause'],
  ['sessionpause', 'session-pause'],
  ['pausesession', 'session-pause'],
  ['session-resume', 'session-resume'],
  ['sessionresume', 'session-resume'],
  ['resumesession', 'session-resume'],
  ['session-stop', 'session-stop'],
  ['sessionstop', 'session-stop'],
  ['stopsession', 'session-stop'],
  ['session-delete', 'session-delete'],
  ['sessiondelete', 'session-delete'],
  ['deletesession', 'session-delete']
])

const BUILTIN_COMMANDS = [
  'menu',
  'help',
  'register',
  'me',
  'ping',
  'uptime',
  'about',
  'status',
  'version',
  'website',
  'quote',
  'random',
  'fact',
  'ai',
  'rules',
  'support',
  'ownercontact',
  'prefix',
  'setprefix',
  'plugins',
  'stats',
  'groupinfo',
  'addmeta',
  'kickmeta',
  'owner',
  'ownerlist',
  'botinfo',
  'botstatus',
  'maintenance',
  'logs',
  'restart',
  'tagall',
  'welcome',
  'session-info',
  'sessions',
  'session-start',
  'session-pair',
  'session-pause',
  'session-resume',
  'session-stop',
  'session-delete'
]

const getDepVersion = (name) => packageMeta.dependencies?.[name] || 'unbekannt'

const getCommandPrefix = () => String(global.db.data.settings.prefix || runtimeConfig.botPrefix || '!').trim() || '!'

const getUserKey = (sender = '') => createHash('md5').update(String(sender || '')).digest('hex')

const formatDateTime = (inputDate) => {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate)
  return Number.isNaN(date.getTime())
    ? 'unbekannt'
    : date.toLocaleString('de-DE', { timeZone: TZ })
}

const formatDuration = (ms = 0) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours || parts.length) parts.push(`${hours}h`)
  if (minutes || parts.length) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

const pickRandom = (entries = [], fallback = '') => {
  const source = Array.isArray(entries) ? entries.filter(Boolean) : []
  if (!source.length) return fallback
  const index = Math.floor(Math.random() * source.length)
  return String(source[index] || fallback)
}

const toEpochMs = (value) => {
  if (typeof value === 'number') return value * 1000
  if (typeof value?.low === 'number') return value.low * 1000
  return Date.now()
}

const normalizeCommand = (raw = '') => {
  const base = String(raw || '').trim().toLowerCase()
  if (!base) return ''
  const normalized = base.replace(/\s+/g, '-')
  return COMMAND_ALIASES.get(base) || COMMAND_ALIASES.get(normalized) || normalized
}

const suggestCommands = (input = '') => {
  const normalized = normalizeCommand(input)
  if (!normalized) return BUILTIN_COMMANDS.slice(0, 4)
  const compact = normalized.replace(/-/g, '')
  return BUILTIN_COMMANDS
    .filter((command) => {
      const current = command.replace(/-/g, '')
      return current.startsWith(compact) || current.includes(compact) || compact.includes(current.slice(0, 3))
    })
    .slice(0, 4)
}

const ensureUser = (sender = '', pushName = '') => {
  const userKey = getUserKey(sender)
  const base = global.db.data.users[userKey] || {}
  global.db.data.users[userKey] = {
    jid: sender,
    pushName: pushName || base.pushName || null,
    registered: base.registered || false,
    name: base.name || null,
    age: base.age || null,
    level: Number.isFinite(base.level) ? base.level : 1,
    xp: Number.isFinite(base.xp) ? base.xp : 0,
    createdAt: base.createdAt || Date.now(),
    lastSeenAt: Date.now(),
    registeredAt: base.registeredAt || null,
    commandCount: Number.isFinite(base.commandCount) ? base.commandCount : 0,
    ...base,
    pushName: pushName || base.pushName || null,
    lastSeenAt: Date.now()
  }
  return global.db.data.users[userKey]
}

const ensureGroupSettings = (chatId = '') => {
  const base = global.db.data.groups[chatId] || {}
  global.db.data.groups[chatId] = {
    welcomeEnabled: base.welcomeEnabled || false,
    createdAt: base.createdAt || Date.now(),
    updatedAt: Date.now(),
    ...base,
    welcomeTemplate: base.welcomeTemplate === PREVIOUS_DEFAULT_TEMPLATES.welcome
      ? DEFAULT_WELCOME_TEMPLATE
      : (base.welcomeTemplate || DEFAULT_WELCOME_TEMPLATE),
    goodbyeTemplate: base.goodbyeTemplate === PREVIOUS_DEFAULT_TEMPLATES.goodbye
      ? DEFAULT_GOODBYE_TEMPLATE
      : (base.goodbyeTemplate || DEFAULT_GOODBYE_TEMPLATE),
    kickTemplate: base.kickTemplate === PREVIOUS_DEFAULT_TEMPLATES.kick
      ? DEFAULT_KICK_TEMPLATE
      : (base.kickTemplate || DEFAULT_KICK_TEMPLATE),
    updatedAt: Date.now()
  }
  return global.db.data.groups[chatId]
}

const rememberSession = (sessionName = '', patch = {}) => {
  const normalized = normalizeSessionName(sessionName)
  if (!normalized) return null
  const base = global.db.data.sessions[normalized] || {}
  global.db.data.sessions[normalized] = {
    id: normalized,
    state: base.state || 'unknown',
    desiredState: base.desiredState || 'stopped',
    createdAt: base.createdAt || Date.now(),
    updatedAt: Date.now(),
    lastStartedAt: base.lastStartedAt || null,
    lastMethod: base.lastMethod || null,
    phoneNumber: base.phoneNumber || null,
    lastError: base.lastError || null,
    ...base,
    ...patch,
    updatedAt: Date.now()
  }
  return global.db.data.sessions[normalized]
}

const getSessionStatus = (session = null) => {
  if (!session) return 'offline'
  const stateCandidates = [
    session.status,
    session.state,
    session.connection,
    session.connectionState,
    session.sessionState,
    session.ws?.readyState === 1 ? 'online' : null,
    session.user ? 'online' : null,
    session.sock?.user ? 'online' : null,
    session.isPaused ? 'paused' : null,
    session.isStopped ? 'stopped' : null
  ]
    .map((entry) => String(entry ?? '').trim().toLowerCase())
    .filter(Boolean)

  if (stateCandidates.some((value) => ['online', 'open', 'connected', 'running', 'ready'].includes(value))) return 'online'
  if (stateCandidates.some((value) => ['paused', 'pause'].includes(value))) return 'paused'
  if (stateCandidates.some((value) => ['stopped', 'stop', 'closed', 'close', 'offline'].includes(value))) return 'offline'
  if (stateCandidates.some((value) => ['connecting', 'starting', 'booting', 'loading', 'standby'].includes(value))) return 'starting'
  return 'unknown'
}

const formatSessionStatusBadge = (status = 'unknown') => {
  switch (status) {
    case 'online':
      return 'online'
    case 'starting':
    case 'connecting':
      return 'verbindet'
    case 'maintenance':
      return 'Wartung'
    case 'paused':
      return 'pausiert'
    case 'offline':
      return 'offline'
    default:
      return 'unbekannt'
  }
}

const getSessionOwnJid = (session = null) => normalizeJid(
  session?.user?.id
  || session?.user?.jid
  || session?.sock?.user?.id
  || session?.sock?.user?.jid
  || session?.authState?.creds?.me?.id
  || ''
)

const getKnownSessionNames = (currentSessionId = '') => {
  const names = new Set([...runtimeConfig.bootstrapSessions, ...Object.keys(global.db.data.sessions || {})])
  const normalizedCurrent = currentSessionId ? normalizeSessionName(currentSessionId) : ''
  if (normalizedCurrent) names.add(normalizedCurrent)

  if (Тишина && typeof Тишина === 'object') {
    const candidates = [Тишина.sessions, Тишина.sessionRegistry, Тишина.sessionStore]
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object') {
        Object.keys(candidate).forEach((key) => names.add(normalizeSessionName(key)))
      }
    }
    if (typeof Тишина.getAllManagedSessions === 'function') {
      for (const managedSession of Тишина.getAllManagedSessions()) {
        if (managedSession?.id) names.add(normalizeSessionName(managedSession.id))
      }
    }
  }

  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de'))
}

const getLiveWhatsAppStatus = () => {
  const statuses = getKnownSessionNames().map((sessionId) => {
    const liveSession = typeof Тишина?.getSession === 'function' ? Тишина.getSession(sessionId) : null
    return getSessionStatus(liveSession)
  })
  if (global.db.data.settings.maintenance) return 'maintenance'
  if (statuses.includes('online')) return 'online'
  if (statuses.includes('starting')) return 'connecting'
  return 'offline'
}

const publishPublicStatus = () => {
  try {
    fs.mkdirSync(path.dirname(RUNTIME_STATUS_PATH), { recursive: true })
    const status = {
      heartbeatAt: Date.now(),
      whatsapp: getLiveWhatsAppStatus(),
      maintenance: global.db.data.settings.maintenance === true,
      prefix: getCommandPrefix(),
      version: packageMeta.version,
      ai: {
        enabled: global.db.data.settings.aiEnabled === true,
        configured: runtimeConfig.ai.configured
      }
    }
    const tempPath = `${RUNTIME_STATUS_PATH}.${process.pid}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(status), { mode: 0o600 })
    fs.renameSync(tempPath, RUNTIME_STATUS_PATH)
  } catch (error) {
    console.error('Öffentlicher Botstatus konnte nicht aktualisiert werden:', error.message)
  }
}

publishPublicStatus()
const publicStatusInterval = setInterval(publishPublicStatus, STATUS_HEARTBEAT_MS)
publicStatusInterval.unref?.()

const getOwnerBySender = (sender = '') => {
  const [number, server = ''] = String(sender || '').trim().split('@')
  if (!number || !['s.whatsapp.net', 'c.us'].includes(server)) return null
  const normalizedNumber = extractDigits(number.split(':')[0])
  return owners.find((owner) => owner.enabled && owner.number === normalizedNumber) || null
}

const isOwner = (sender = '') => Boolean(getOwnerBySender(sender))

const hasOwnerLevel = (sender = '', requiredLevel = 90) => {
  const owner = getOwnerBySender(sender)
  if (!owner || owner.level < requiredLevel) return false
  return requiredLevel < 100 || (owner.id === 1 && owner.level === 100)
}

const canManageSessions = (sender = '') => isOwner(sender)

const buildSessionManagementDeniedText = () => {
  const contactLine = ownerConfig.ownerContact ? `\nKontakt: ${ownerConfig.ownerContact}` : ''
  return `*🥀 ТИШИНА — ZUGRIFF BESCHRÄNKT*\n\nDiese Session-Steuerung ist dem Owner vorbehalten.${contactLine}`
}

const grantXp = (user, amount = 0) => {
  const previousLevel = Number.isFinite(user.level) ? user.level : 1
  user.xp = Number.isFinite(user.xp) ? user.xp + amount : amount
  user.level = Math.max(previousLevel, Math.floor(user.xp / 100) + 1)
  return {
    leveledUp: user.level > previousLevel,
    previousLevel,
    level: user.level
  }
}

const resolveProfilePicture = async (session, jid) => {
  try {
    if (typeof session?.profilePictureUrl === 'function') {
      return await session.profilePictureUrl(jid, 'image').catch(() => null)
    }
    if (typeof session?.getProfilePictureUrl === 'function') {
      return await session.getProfilePictureUrl(jid).catch(() => null)
    }
  } catch {
    return null
  }
  return null
}

const resolveGroupMetadata = async (session, chatId) => {
  if (!chatId.endsWith('@g.us')) return null
  if (typeof session?.groupMetadata === 'function') {
    return await session.groupMetadata(chatId).catch(() => null)
  }
  if (typeof session?.getGroupMetadata === 'function') {
    return await session.getGroupMetadata(chatId).catch(() => null)
  }
  return null
}

const resolveEnvPath = (value = '') => {
  const rawPath = String(value || '').trim()
  if (!rawPath) return ''
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(__dirname, rawPath)
}

const getEventBannerSource = (eventAction = '') => {
  const action = String(eventAction || '').trim().toLowerCase()
  const urlByAction = {
    welcome: process.env.WELCOME_BANNER_URL,
    goodbye: process.env.LEAVE_BANNER_URL,
    kick: process.env.KICK_BANNER_URL
  }
  const pathByAction = {
    welcome: process.env.WELCOME_BANNER_PATH,
    goodbye: process.env.LEAVE_BANNER_PATH,
    kick: process.env.KICK_BANNER_PATH
  }

  const bannerUrl = String(urlByAction[action] || '').trim()
  if (bannerUrl) return { url: bannerUrl }

  const configuredPath = resolveEnvPath(pathByAction[action])
  const bannerPath = configuredPath || DEFAULT_EVENT_BANNER_PATH
  if (fs.existsSync(bannerPath)) return fs.readFileSync(bannerPath)

  return null
}

const META_AI_JID = '867051314767696@bot'
const getParticipantJids = (participant = {}) => unique(
  [participant?.id, participant?.jid, participant?.lid, participant?.phoneNumber, participant?.participant]
    .map((value) => {
      if (typeof value === 'string') return normalizeJid(value)
      if (value && typeof value.user === 'string' && typeof value.server === 'string') {
        return `${value.user}@${value.server}`
      }
      return ''
    })
)

const areJidsSameUser = (left = '', right = '') => {
  const normalize = (jid) => {
    const [user = '', server = ''] = String(jid || '').trim().toLowerCase().split('@')
    return {
      user: user.split(':')[0],
      server
    }
  }
  const first = normalize(left)
  const second = normalize(right)
  if (!first.user || !first.server || !second.user || !second.server) return false
  if (first.user === second.user && first.server === second.server) return true

  const userServers = new Set(['s.whatsapp.net', 'c.us', 'lid'])
  return userServers.has(first.server)
    && userServers.has(second.server)
    && extractDigits(first.user) !== ''
    && extractDigits(first.user) === extractDigits(second.user)
}

const isMetaAiParticipant = (participant) => getParticipantJids(participant).some((jid) => {
  const [user = '', server = ''] = jid.toLowerCase().split('@')
  return !!server
    && !['g.us', 'broadcast'].includes(server)
    && extractDigits(user.split(':')[0]) === '867051314767696'
})

const fetchFreshGroupMetadata = async (session, chatId) => {
  const loadMetadata = typeof session?.groupMetadata === 'function'
    ? session.groupMetadata.bind(session)
    : (typeof session?.getGroupMetadata === 'function' ? session.getGroupMetadata.bind(session) : null)
  if (!loadMetadata) return { metadata: null, error: new Error('Gruppenmetadaten werden von dieser Session nicht unterstützt.') }

  let metadata = null
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      metadata = await loadMetadata(chatId)
      lastError = null
    } catch (error) {
      metadata = null
      lastError = error
    }
    if (Array.isArray(metadata?.participants) && metadata.participants.length) {
      return { metadata, error: null }
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 800))
  }
  return { metadata, error: lastError }
}

const manageMetaAiInGroup = async ({ session, chatId, sender, senderJids, quoted, action }) => {
  const { metadata, error: metadataError } = await fetchFreshGroupMetadata(session, chatId)
  const participants = Array.isArray(metadata?.participants) ? metadata.participants : []
  if (!participants.length) {
    if (metadataError) console.warn(`${action} konnte Gruppenmitglieder nicht laden:`, metadataError.message)
    await sendТишина(session, chatId, [
      '> ┌─ 🤖 *META AI · GRUPPENZUGANG*',
      '> │ Status: nicht prüfbar',
      '> └ Mitgliederliste konnte nicht geladen werden. Bitte später erneut versuchen.'
    ].join('\n'), { quoted })
    return
  }

  const senderIsAdmin = participants.some((participant) =>
    ['admin', 'superadmin'].includes(participant?.admin)
    && getParticipantJids(participant).some((participantJid) =>
      senderJids.some((senderJid) => areJidsSameUser(participantJid, senderJid))
    )
  )
  if (!isOwner(sender) && !senderIsAdmin) {
    await sendТишина(session, chatId, '> ⛔ *Zugriff verweigert:* Nur Owner oder Gruppen-Admins dürfen Meta AI steuern.', { quoted })
    return
  }

  const botJids = unique([
    getSessionOwnJid(session),
    session?.user?.lid,
    session?.authState?.creds?.me?.id,
    session?.authState?.creds?.me?.lid
  ].map(normalizeJid))
  const botIsAdmin = participants.some((participant) =>
    ['admin', 'superadmin'].includes(participant?.admin)
    && getParticipantJids(participant).some((participantJid) =>
      botJids.some((botJid) => areJidsSameUser(participantJid, botJid))
    )
  )
  if (!botIsAdmin) {
    await sendТишина(session, chatId, action === 'add'
      ? '> ⛔ *Der Bot braucht Adminrechte.*\n\nBitte mache den Bot in den Gruppeninfos zum Admin und versuche es erneut.'
      : '> ⛔ *Der Bot braucht Adminrechte,* um Gruppenmitglieder zu entfernen.', { quoted })
    return
  }

  const metaAlreadyPresent = participants.some(isMetaAiParticipant)
  if (action === 'add' && metaAlreadyPresent) {
    await sendТишина(session, chatId, '> ┌─ 🤖 *META AI · GRUPPENZUGANG*\n> │ Status: bereits dabei\n> └ Es ist nichts zu ändern.', { quoted })
    return
  }
  if (action === 'remove' && !metaAlreadyPresent) {
    await sendТишина(session, chatId, '> ┌─ 🤖 *META AI · GRUPPENZUGANG*\n> │ Status: nicht vorhanden\n> └ Es ist nichts zu ändern.', { quoted })
    return
  }
  if (typeof session?.groupParticipantsUpdate !== 'function') {
    await sendТишина(session, chatId, 'Diese WhatsApp-Session unterstützt keine Gruppenmitglieder-Änderungen.', { quoted })
    return
  }

  let results
  try {
    results = await session.groupParticipantsUpdate(chatId, [META_AI_JID], action)
    if (!Array.isArray(results) || !results.length) {
      throw new Error('WhatsApp hat keinen Ergebnisstatus für die Gruppenänderung zurückgegeben.')
    }
    const rejected = results.find((result) => !['200', '201'].includes(String(result?.status || '')))
    if (rejected) throw new Error(`WhatsApp-Status ${rejected.status || 'unbekannt'}`)
  } catch (updateError) {
    const errorText = String(updateError?.message || updateError)
    console.error(`Meta AI ${action === 'add' ? 'Hinzufügen' : 'Entfernen'} in ${chatId} fehlgeschlagen:`, updateError)
    const explanation = action === 'add' && /forbidden|403/i.test(errorText)
      ? 'WhatsApp hat die Aufnahme abgelehnt (403 Forbidden). Die Gruppenberechtigung erlaubt diesen Beitritt derzeit nicht.'
      : `WhatsApp konnte Meta AI nicht ${action === 'add' ? 'hinzufügen' : 'entfernen'}: ${errorText.slice(0, 180)}`
    await sendТишина(session, chatId, `> ┌─ 🤖 *META AI · GRUPPENZUGANG*\n> │ Status: fehlgeschlagen ❌\n> └ ${explanation}`, { quoted })
    return
  }

  const verb = action === 'add' ? 'hinzugefügt' : 'entfernt'
  await sendТишина(session, chatId, `> ┌─ 🤖 *META AI · GRUPPENZUGANG*\n> │ Status: ${verb} ✅\n> └ ${action === 'add' ? 'Willkommen in der Gruppe.' : 'Meta AI ist nicht mehr Teil der Gruppe.'}`, { quoted })
  console.info(`Meta AI (${META_AI_JID}) in ${chatId} ${verb}.`)
}

const menuSessionKey = (chatId, sender) => `${chatId}:${sender}`

const getMenuSession = (chatId, sender) => {
  const key = menuSessionKey(chatId, sender)
  let state = menuSessions.get(key)
  if (!state || state.expiresAt <= Date.now()) {
    state = { sender, page: 0, selectedCategory: null, lastInteraction: Date.now(), expiresAt: Date.now() + MENU_SESSION_TTL_MS }
    menuSessions.set(key, state)
  }
  state.lastInteraction = Date.now()
  state.expiresAt = state.lastInteraction + MENU_SESSION_TTL_MS
  return state
}

const menuCleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, state] of menuSessions) {
    if (state.expiresAt <= now) menuSessions.delete(key)
  }
  for (const [groupId, expiresAt] of tagAllCooldowns) {
    if (expiresAt <= now) tagAllCooldowns.delete(groupId)
  }
}, 60_000)
menuCleanupInterval.unref?.()

const renderInteractiveMenu = async ({ session, chatId, sender, quoted = null, reset = false } = {}) => {
  const state = getMenuSession(chatId, sender)
  if (reset) {
    state.page = 0
    state.selectedCategory = null
  }

  const prefix = getCommandPrefix()
  let payload

  if (state.selectedCategory) {
    const category = MENU_CATEGORIES[state.selectedCategory]
    const commands = (publicCommandGroups.find((group) => group.category === category.commandCategory)?.commands || [])
      .filter((entry) => entry.available !== false)
      .filter((entry) => !entry.protected || isOwner(sender))
    payload = buildWhatsAppCategoryMenu({
      categoryId: state.selectedCategory,
      commands,
      prefix,
      ownerName: ownerConfig.ownerName,
      page: state.page
    })
  } else {
    payload = buildWhatsAppMainMenu({
      prefix,
      version: packageMeta.version,
      ownerName: ownerConfig.ownerName,
      includeAdministration: isOwner(sender)
    })
  }

  try {
    return await session.sendMessage(chatId, sanitizeGroupPayload(chatId, payload), buildMessageSendOptions({ quoted }))
  } catch (error) {
    console.warn('Interaktives WhatsApp-Menü nicht verfügbar; sende die Textansicht:', error.message)
    return sendТишина(session, chatId, payload.text, { quoted })
  }
}

const buildHelpText = () => {
  const prefix = getCommandPrefix()
  return [
    '*🥀 ТИШИНА — HILFE*',
    'Ruhig, klar und Schritt für Schritt.',
    '',
    '*Befehle*',
    `• \`${prefix}ping\` → prüft ob die Base lebt`,
    `• \`${prefix}status\` / \`${prefix}version\` / \`${prefix}website\` → öffentliche Informationen`,
    `• \`${prefix}quote\` / \`${prefix}random\` / \`${prefix}fact\` → Gedanken und Fakten`,
    `• \`,ai <Frage>\` → optionale KI-Antwort nach Owner-Aktivierung`,
    `• \`${prefix}uptime\` → zeigt Uptime, Bootzeit und Counters`,
    `• \`${prefix}about\` → zeigt Stack & Branding`,
    `• \`${prefix}rules\` → zeigt Regeln fürs Miteinander`,
    `• \`${prefix}support\` → zeigt Kontakt & Hilfeweg`,
    `• \`${prefix}addmeta\` / \`${prefix}kickmeta\` → Meta AI in Gruppen verwalten (Owner/Admin)`,
    `• \`${prefix}ownercontact\` → zeigt den Owner-Kontakt`,
    `• \`${prefix}prefix\` → zeigt den aktiven Prefix`,
    `• \`${prefix}plugins\` → zeigt eingebaute WhatsApp-Features`,
    `• \`${prefix}stats\` → zeigt Laufzeit, Nutzer und Command-Zahlen`,
    `• \`${prefix}register <Name>\` / \`${prefix}me\` → kleines Profilsystem`,
    `• \`${prefix}tagall [Nachricht]\` → erwähnt Gruppenmitglieder mit optionaler Ankündigung`,
    `• \`${prefix}groupinfo\` → zeigt Gruppenname, Admins und Beschreibung`,
    `• \`${prefix}welcome on|off|status|preview\` → Welcome-System`,
    `• \`${prefix}welcome set <Text>\` → eigener Welcome-Text`,
    `• \`${prefix}welcome setbye <Text>\` → eigener Bye-Text`,
    `• \`${prefix}setprefix <neu>\` → ändert den Prefix (Owner-only)`,
    `• \`${prefix}sessions\` / \`${prefix}session-info\` → Multi-Session-Überblick`,
    '',
    '*Welcome-Platzhalter*',
    '• `@user` → neuer / gehender Nutzer',
    '• `@subject` → Gruppenname',
    '• `@desc` → Gruppenbeschreibung',
    '• `@count` → Mitgliederzahl',
    '• `@session` → aktive Session-ID',
    '',
    '*Zugriff*',
    '• Session- und Owner-Befehle sind auf sieben aktivierte Owner beschränkt.',
    '',
    `— By ${ownerConfig.ownerName}`
  ].join('\n')
}

const buildAboutText = () => [
  '*🥀 ТИШИНА*',
  '«Иногда тишина говорит больше, чем тысяча слов.»',
  '',
  'Manchmal braucht es keine großen Worte. Тишина verbindet eine ruhige Persönlichkeit mit einer technisch modernen WhatsApp-Basis.',
  '',
  '*SYSTEM INFORMATION*',
  '• Plattform: WhatsApp',
  `• Runtime: Node.js`,
  `• Version: ${packageMeta.version}`,
  `• Prefix: ${getCommandPrefix()}`,
  '',
  '*Technik*',
  `• @neelegirly/wa-api: ${getDepVersion('@neelegirly/wa-api')}`,
  `• @neelegirly/baileys: ${getDepVersion('@neelegirly/baileys')}`,
  `• @neelegirly/libsignal: ${getDepVersion('@neelegirly/libsignal')}`,
  `• @neelegirly/downloader: ${getDepVersion('@neelegirly/downloader')}`,
  `• lowdb: ${getDepVersion('lowdb')}`,
  '',
  'Stille • Sehnsucht • Erinnerungen • Hoffnung • Neuanfang',
  '',
  `— By ${ownerConfig.ownerName}`
].join('\n')

const buildPluginsText = () => [
  '*🥀 ТИШИНА — FUNKTIONEN*',
  '',
  'Ein ruhiger Auftritt, getragen von einer klaren WhatsApp-Basis.',
  '',
  '*Eingebaut*',
  '• WhatsApp Message Parser für Text, Bilder, Videos, Dokumente, Buttons und Listen',
  '• Profilsystem mit Register / Me / XP / Level',
  '• Prefix-, Uptime- und Gruppeninfo-Commands für den Alltag',
  '• Welcome / Goodbye via WhatsApp-Stub-Events',
  '• Multi-Session-Steuerung per Chat-Commands',
  '• Owner-Hilfe und Runtime-Statistiken',
  '• Menü mit Button-Fallback für ältere Clients',
  '',
  '*Absichtlich nicht drin*',
  '• keine Discord-Logik',
  '• keine Telegram-Brücke',
  '• keine ausgelagerte Command-Orgie',
  '',
  `— By ${ownerConfig.ownerName}`
].join('\n')

const buildStatsText = () => {
  const commandUsage = Object.entries(global.db.data.stats.commandUsage || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([command, count]) => `• ${command}: ${count}`)

  return [
    '*🥀 ТИШИНА — SYSTEM STATUS*',
    '',
    `Laufzeit   ${formatDuration(Date.now() - BOOT_AT)}`,
    `Nachrichten   ${global.db.data.stats.totalMessages}`,
    `Befehle   ${global.db.data.stats.totalCommands}`,
    `Profile   ${Object.keys(global.db.data.users || {}).length}`,
    `Gruppen   ${Object.keys(global.db.data.groups || {}).length}`,
    `Sessions   ${getKnownSessionNames().length}`,
    `Begrüßungen   ${global.db.data.stats.totalWelcomes}`,
    `Abschiede   ${global.db.data.stats.totalGoodbyes}`,
    `Moderationen   ${global.db.data.stats.totalKicks}`,
    '',
    '*Häufigste Befehle*',
    ...(commandUsage.length ? commandUsage : ['• noch keine Commands gezählt'])
  ].join('\n')
}

const buildRulesText = () => [
  '*🥀 ТИШИНА — GEMEINSAME REGELN*',
  '',
  '1. Begegne anderen mit Respekt.',
  '2. Verzichte auf Spam und unnötige Unruhe.',
  '3. Teile keine privaten Daten, Nummern oder Zugangsdaten.',
  '4. Akzeptiere Moderationsentscheidungen.',
  '5. Wenn etwas nicht stimmt, wende dich ruhig an den Support.',
  '',
  'Ein stiller Ort bleibt nur dann ein guter Ort, wenn wir aufeinander achten.'
].join('\n')

const buildSupportText = () => {
  const ownerContact = ownerConfig.ownerContact || 'nicht gesetzt'
  return [
    '*🥀 ТИШИНА — KONTAKT*',
    '',
    `Owner   ${ownerConfig.ownerName}`,
    `Kontakt   ${ownerContact}`,
    `Session   ${DEFAULT_SESSION_NAME}`,
    '',
    'Beschreibe kurz, was passiert, seit wann und welcher Befehl betroffen ist.',
    '',
    `— By ${ownerConfig.ownerName}`
  ].join('\n')
}

const buildOwnerText = () => {
  const prefix = getCommandPrefix()
  return [
    '*🥀 ТИШИНА — ADMINISTRATION*',
    '',
    `\`${prefix}ownerlist\` · Autorisierte Owner anzeigen`,
    `\`${prefix}botinfo\` · Bot-Informationen`,
    `\`${prefix}botstatus\` · Betriebsstatus`,
    `\`${prefix}maintenance on|off|status\` · Wartungsmodus`,
    `\`${prefix}logs\` · Fehlerprotokoll (Hauptinhaber, Privat-Chat)`,
    `\`${prefix}restart\` · Neustart über PM2 (Hauptinhaber)`,
    '',
    `• \`${prefix}sessions\` → alle bekannten Sessions listen`,
    `• \`${prefix}session-start <name>\` → z. B. Support per QR verbinden`,
    `• \`${prefix}session-pair <name> <telefonnummer>\` → unabhängige Session per Pairing starten`,
    `• \`${prefix}session-pause <id>\` → Session pausieren`,
    `• \`${prefix}session-resume <id>\` → Session fortsetzen`,
    `• \`${prefix}session-stop <id>\` → Session stoppen`,
    `• \`${prefix}session-delete <name>\` → Session entfernen`,
    `• Hauptsession löschen: \`${prefix}session-delete Maxichen CONFIRM\` (nur Hauptinhaber)`,
    '',
    `Website: ${BOT_OWNER_INFO.website}`,
    'Telefonnummern werden nicht in Bot-Nachrichten angezeigt.'
  ].join('\n')
}

const buildOwnerListText = () => [
  '*🥀 ТИШИНА — AUTORISIERTE OWNER*',
  '',
  ...owners.map((owner) => `${owner.id}. ${owner.name} · ${owner.role}${owner.enabled ? '' : ' · deaktiviert'}`),
  '',
  `Entwickler und Hauptinhaber: ${BOT_OWNER_INFO.developer}`,
  'Telefonnummern werden aus Datenschutzgründen nicht angezeigt.'
].join('\n')

const buildBotInfoText = () => [
  '*🥀 ТИШИНА — BOT INFORMATION*',
  '',
  `Name   ${BOT_OWNER_INFO.name}`,
  `Entwickler   ${BOT_OWNER_INFO.developer}`,
  `Autorisierte Owner   ${owners.filter((owner) => owner.enabled).length}`,
  `Version   ${packageMeta.version}`,
  'Plattform   WhatsApp',
  `Website   ${BOT_OWNER_INFO.website}`
].join('\n')

const buildBotStatusText = (sessionId = '', session = null) => [
  '*🥀 ТИШИНА — BOT STATUS*',
  '',
  `WhatsApp   ${formatSessionStatusBadge(getSessionStatus(session))}`,
  `Session   ${sessionId || 'unbekannt'}`,
  `Laufzeit   ${formatDuration(Date.now() - BOOT_AT)}`,
  `Wartungsmodus   ${global.db.data.settings.maintenance ? 'aktiv' : 'inaktiv'}`,
  `Nachrichten   ${global.db.data.stats.totalMessages}`,
  `Befehle   ${global.db.data.stats.totalCommands}`
].join('\n')

const buildAiHelpText = () => [
  '*🥀 ТИШИНА — OPTIONALE KI*',
  '',
  'Die KI ist nur mit gültigem Anbieter, API-Key und Modell verfügbar und wird nicht automatisch auf Nachrichten angewendet.',
  '',
  'Owner:',
  '`,ai on` · KI global aktivieren',
  '`,ai off` · KI deaktivieren',
  '`,ai status` · Konfiguration und Status ansehen',
  '',
  'Frage:',
  '`,ai <deine Frage>` · Antwort ausdrücklich anfordern',
  '',
  'Gruppenanfragen werden nur nach ausdrücklichem `,ai`-Aufruf verarbeitet.'
].join('\n')

const getAiUsage = (sender) => {
  const date = new Date().toISOString().slice(0, 10)
  const key = getUserKey(sender)
  const saved = global.db.data.settings.aiUsage[key]
  if (!saved || saved.date !== date) {
    global.db.data.settings.aiUsage[key] = { date, count: 0 }
  }
  return global.db.data.settings.aiUsage[key]
}

const generateAiAnswer = async (sender, prompt) => {
  if (!runtimeConfig.ai.configured || !runtimeConfig.ai.endpoint) {
    const error = new Error('Die KI ist nicht vollständig konfiguriert.')
    error.code = 'AI_NOT_CONFIGURED'
    throw error
  }
  if (!global.db.data.settings.aiEnabled) {
    const error = new Error('Die KI ist deaktiviert.')
    error.code = 'AI_DISABLED'
    throw error
  }

  const safePrompt = String(prompt || '').trim().slice(0, 2000)
  if (!safePrompt) {
    const error = new Error('Bitte gib eine Frage an.')
    error.code = 'AI_EMPTY_PROMPT'
    throw error
  }

  const usage = getAiUsage(sender)
  if (usage.count >= runtimeConfig.ai.dailyLimit) {
    const error = new Error('Das tägliche KI-Limit wurde erreicht.')
    error.code = 'AI_DAILY_LIMIT'
    throw error
  }
  usage.count += 1
  await saveDatabase()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(runtimeConfig.ai.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtimeConfig.ai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: runtimeConfig.ai.model,
        messages: [
          {
            role: 'system',
            content: 'Du bist Тишина: ruhig, intelligent, geheimnisvoll, poetisch und verständnisvoll. Antworte in der Sprache des Nutzers, natürlich und sinnvoll. Verwende gelegentlich eine kurze russische Formulierung, aber nicht aufdringlich. Sei respektvoll und vermittle bei emotional schwierigen Gesprächen Zuversicht. Erfinde keine technischen Fakten. Halte Antworten klar und gewöhnlich unter 1200 Zeichen.'
          },
          { role: 'user', content: safePrompt }
        ],
        max_tokens: 700,
        temperature: 0.7
      }),
      signal: controller.signal
    })
    if (!response.ok) {
      const error = new Error(`KI-Anbieter antwortete mit HTTP ${response.status}.`)
      error.code = 'AI_PROVIDER_ERROR'
      throw error
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content
    const answer = Array.isArray(content)
      ? content.map((part) => typeof part?.text === 'string' ? part.text : '').join('')
      : content
    if (typeof answer !== 'string' || !answer.trim()) {
      const error = new Error('Der KI-Anbieter lieferte keine Antwort.')
      error.code = 'AI_EMPTY_RESPONSE'
      throw error
    }
    return answer.trim().slice(0, 3500)
  } catch (error) {
    if (error.name === 'AbortError') error.code = 'AI_TIMEOUT'
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

const readRecentErrorLogs = (limit = 20) => {
  const logPath = path.join(__dirname, 'logs', 'ТишинаBaseV3.error.log')
  if (!fs.existsSync(logPath)) return 'Noch sind keine Fehlerprotokolle vorhanden.'
  return fs.readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => redactPhoneNumbers(line).slice(0, 500))
    .join('\n') || 'Das Fehlerprotokoll ist leer.'
}

const buildSessionInfoText = (sessionId = '', session = null, sender = '', chatId = '') => {
  const ownJid = getSessionOwnJid(session)
  return [
    '*🥀 ТИШИНА — SESSION STATUS*',
    '',
    `Session   ${sessionId || 'unbekannt'}`,
    `Status   ${formatSessionStatusBadge(getSessionStatus(session))}`,
    `Bot-ID   ${ownJid || 'noch unbekannt'}`,
    `Chat   ${chatId || 'unbekannt'}`,
    `Owner   ${isOwner(sender) ? 'ja' : 'nein'}`,
    `Steuerung   ${canManageSessions(sender) ? 'freigegeben' : 'nur Owner'}`,
    '',
    `Bekannte Sessions   ${getKnownSessionNames(sessionId).length}`
  ].join('\n')
}

const buildSessionsText = (currentSessionId = '') => {
  const names = getKnownSessionNames(currentSessionId)
    .sort((left, right) => left === DEFAULT_SESSION_NAME ? -1 : right === DEFAULT_SESSION_NAME ? 1 : left.localeCompare(right, 'de'))
  if (!names.length) {
    return '*🥀 ТИШИНА — KEINE SESSION*\n\nSetze `WA_API_BOOTSTRAP_SESSIONS` in der `.env` oder starte eine Session mit `!session-start <id>`.'
  }

  const sessions = names.map((name) => {
    const liveSession = typeof Тишина?.getSession === 'function' ? Тишина.getSession(name) : null
    const knownEntry = global.db.data.sessions?.[name] || null
    const status = liveSession ? getSessionStatus(liveSession) : (knownEntry?.state || 'offline')
    const role = name === DEFAULT_SESSION_NAME
      ? 'Primary'
      : (name.slice(SESSION_PREFIX.length).toLowerCase() === 'support' ? 'Support' : 'Additional')
    return { name, status, role }
  })
  const primary = sessions.filter(({ role }) => role === 'Primary')
  const others = sessions.filter(({ role }) => role !== 'Primary')
  const onlineCount = sessions.filter(({ status }) => status === 'online').length
  const connectingCount = sessions.filter(({ status }) => ['starting', 'connecting'].includes(status)).length
  const offlineCount = sessions.length - onlineCount - connectingCount
  const lines = ['*🥀 ТИШИНА — SESSION MANAGEMENT*', '']

  if (primary.length) {
    lines.push('*HAUPTSESSION*', '')
    for (const { name, status, role } of primary) {
      lines.push(`${name}\nStatus: ${formatSessionStatusBadge(status)}\nRolle: ${role}`, '')
    }
  }
  if (others.length) {
    lines.push('*WEITERE SESSIONS*', '')
    for (const { name, status, role } of others) {
      lines.push(`${name}\nStatus: ${formatSessionStatusBadge(status)}\nRolle: ${role}`, '')
    }
  }
  lines.push(
    '*GESAMT*',
    `Sessions: ${sessions.length}`,
    `Online: ${onlineCount}`,
    `Connecting: ${connectingCount}`,
    `Offline: ${offlineCount}`,
    '',
    '— By Maxichen'
  )
  return lines.join('\n')
}

const buildUnknownCommandText = (command = '') => {
  const prefix = getCommandPrefix()
  const suggestions = suggestCommands(command).map((entry) => `\`${prefix}${entry}\``)
  return [
    `*🥀 ТИШИНА — BEFEHL NICHT GEFUNDEN*\n\n\`${prefix}${command}\``,
    '',
    suggestions.length
      ? `Vielleicht meintest du: ${suggestions.join(', ')}`
      : `Nutze \`${prefix}menu\` oder \`${prefix}help\` für eine Übersicht.`
  ].join('\n')
}

const formatWelcomeTemplate = ({ template = '', participant = '', subject = '', description = '', memberCount = 0, sessionId = '' }) => {
  return String(template || '')
    .replace(/\{user\}/g, getDisplayMention(participant))
    .replace(/@user/g, getDisplayMention(participant))
    .replace(/\{subject\}/g, subject || 'Unbekannte Gruppe')
    .replace(/@subject/g, subject || 'Unbekannte Gruppe')
    .replace(/\{desc\}/g, description || 'Keine Beschreibung gesetzt.')
    .replace(/@desc/g, description || 'Keine Beschreibung gesetzt.')
    .replace(/\{count\}/g, String(memberCount || 0))
    .replace(/@count/g, String(memberCount || 0))
    .replace(/\{session\}/g, sessionId || 'unbekannt')
    .replace(/@session/g, sessionId || 'unbekannt')
    .replace(/\{owner\}/g, ownerConfig.ownerName || 'Owner')
    .replace(/@owner/g, ownerConfig.ownerName || 'Owner')
    .replace(/\{moderator\}/g, '@moderator')
    .replace(/@moderator/g, '@moderator')
    .replace(/\{reason\}/g, 'kein Grund verfügbar')
    .replace(/@reason/g, 'kein Grund verfügbar')
}

const formatGroupActionTemplate = ({
  template = '',
  participant = '',
  subject = '',
  description = '',
  memberCount = 0,
  sessionId = '',
  moderator = '',
  reason = ''
}) => {
  const moderatorMention = moderator ? getDisplayMention(moderator) : 'Unbekannt'
  const finalReason = String(reason || '').trim() || 'kein Grund verfügbar'
  return formatWelcomeTemplate({
    template,
    participant,
    subject,
    description,
    memberCount,
    sessionId
  })
    .replace(/\{moderator\}/g, moderatorMention)
    .replace(/@moderator/g, moderatorMention)
    .replace(/\{reason\}/g, finalReason)
    .replace(/@reason/g, finalReason)
}

const getRandomGroupActionTemplate = (action = '', groupConfig = {}) => {
  if (action === 'welcome') {
    if (groupConfig.welcomeTemplate && groupConfig.welcomeTemplate !== DEFAULT_WELCOME_TEMPLATE) return groupConfig.welcomeTemplate
    return pickRandom(WELCOME_RANDOM_PHRASES, DEFAULT_WELCOME_TEMPLATE)
  }

  if (action === 'goodbye') {
    if (groupConfig.goodbyeTemplate && groupConfig.goodbyeTemplate !== DEFAULT_GOODBYE_TEMPLATE) return groupConfig.goodbyeTemplate
    return pickRandom(LEAVE_RANDOM_PHRASES, DEFAULT_GOODBYE_TEMPLATE)
  }

  if (action === 'kick') {
    if (groupConfig.kickTemplate && groupConfig.kickTemplate !== DEFAULT_KICK_TEMPLATE) return groupConfig.kickTemplate
    return pickRandom(KICK_RANDOM_PHRASES, DEFAULT_KICK_TEMPLATE)
  }

  return DEFAULT_GOODBYE_TEMPLATE
}

const buildWelcomeStatusText = (groupConfig, subject = '') => {
  const prefix = getCommandPrefix()
  return [
    `*🥀 ТИШИНА — BEGRÜSSUNGEN${subject ? ` · ${subject}` : ''}*`,
    '',
    `Status   ${groupConfig.welcomeEnabled ? 'aktiv' : 'inaktiv'}`,
    `Begrüßung   ${groupConfig.welcomeTemplate}`,
    `Abschied   ${groupConfig.goodbyeTemplate}`,
    `Moderation   ${groupConfig.kickTemplate || DEFAULT_KICK_TEMPLATE}`,
    '',
    '*Verwendung*',
    `• \`${prefix}welcome on\``,
    `• \`${prefix}welcome off\``,
    `• \`${prefix}welcome preview\``,
    `• \`${prefix}welcome set <Text>\``,
    `• \`${prefix}welcome setbye <Text>\``,
    `• \`${prefix}welcome setkick <Text>\``,
    `• \`${prefix}welcome reset\``
  ].join('\n')
}

const normalizeInteractiveCommand = (text = '', messageType = '') => {
  const prefix = getCommandPrefix()
  const normalized = String(text || '').trim()
  if (!normalized) return ''
  const menuAction = /^TISHINA_MENU_(HOME|BACK|NEXT|GENERAL|INFORMATION|ENTERTAINMENT|COMMUNITY|ADMINISTRATION)$/i.exec(normalized)
  if (menuAction) {
    const action = menuAction[1].toLowerCase()
    return action === 'home'
      ? `${prefix}menu`
      : `${prefix}menu ${action}`
  }
  const quickAction = /^TISHINA_COMMAND_(HELP|STATUS|WEBSITE)$/i.exec(normalized)
  if (quickAction) return `${prefix}${quickAction[1].toLowerCase()}`
  if (normalized.startsWith(prefix) || normalized.startsWith(',')) return normalized
  if (normalized.startsWith('cmd:')) return `${prefix}${normalized.slice(4)}`
  if (['Button', 'List', 'Interactive'].includes(messageType)) return `${prefix}${normalized}`
  return normalized
}

const parseInteractiveParams = (params) => {
  const json = safeJsonParse(params, {}) || {}
  return String(json.id || json.command || json.rowId || json.selectedId || '').trim()
}

const parseIncomingMessage = (msg = {}) => {
  const { message } = msg
  const stubType = Number(msg?.messageStubType || 0)
  const stubName = WAMessageStubType?.[stubType] || ''

  if (message?.extendedTextMessage) {
    return { type: 'ExtendedText', text: message.extendedTextMessage.text || '', stubType, stubName }
  }
  if (message?.conversation) {
    return { type: 'Text', text: message.conversation || '', stubType, stubName }
  }
  if (message?.imageMessage) {
    return { type: 'Image', text: message.imageMessage.caption || '', stubType, stubName }
  }
  if (message?.videoMessage) {
    return { type: 'Video', text: message.videoMessage.caption || '', stubType, stubName }
  }
  if (message?.documentMessage) {
    return { type: 'Document', text: message.documentMessage.caption || '', stubType, stubName }
  }
  if (message?.buttonsResponseMessage) {
    return {
      type: 'Button',
      text: message.buttonsResponseMessage.selectedButtonId || message.buttonsResponseMessage.selectedDisplayText || '',
      stubType,
      stubName
    }
  }
  if (message?.templateButtonReplyMessage) {
    return {
      type: 'Button',
      text: message.templateButtonReplyMessage.selectedId || message.templateButtonReplyMessage.selectedDisplayText || '',
      stubType,
      stubName
    }
  }
  if (message?.listResponseMessage) {
    return {
      type: 'List',
      text: message.listResponseMessage.singleSelectReply?.selectedRowId || message.listResponseMessage.title || '',
      stubType,
      stubName
    }
  }
  if (message?.interactiveResponseMessage) {
    const params = message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || '{}'
    return {
      type: 'Interactive',
      text: parseInteractiveParams(params),
      stubType,
      stubName
    }
  }
  if (message?.reactionMessage) {
    return {
      type: 'Reaction',
      text: message.reactionMessage.text || '',
      stubType,
      stubName
    }
  }
  if (message?.audioMessage) {
    return { type: 'Audio', text: '', stubType, stubName }
  }
  if (message?.stickerMessage) {
    return { type: 'Sticker', text: '', stubType, stubName }
  }
  return {
    type: stubName ? 'SystemStub' : 'Unknown',
    text: '',
    stubType,
    stubName
  }
}

const resolveParticipantEvent = (msg = {}, sender = '') => {
  const stubType = Number(msg?.messageStubType || 0)
  if (!stubType) return null

  const stubName = String(WAMessageStubType?.[stubType] || '').trim().toUpperCase()
  if (!stubName) return null

  const parameterMentions = normalizeMentionList(msg?.messageStubParameters || [])
  const participants = parameterMentions.length ? parameterMentions : normalizeMentionList([sender])
  const actor = normalizeJid(msg?.key?.participant || msg?.participant || sender)

  if (/(GROUP_PARTICIPANT_ADD|GROUP_PARTICIPANT_INVITE|GROUP_PARTICIPANT_LINKED_GROUP_JOIN|GROUP_PARTICIPANT_JOIN_REQUEST_APPROVED)/.test(stubName)) {
    return { action: 'welcome', participants, actor, stubName }
  }
  if (/(GROUP_PARTICIPANT_REMOVE|GROUP_PARTICIPANT_LEAVE)/.test(stubName)) {
    const removedParticipant = participants[0] || ''
    const actorFromParams = normalizeJid((msg?.messageStubParameters || [])[1] || '')
    const effectiveActor = actorFromParams || actor
    const isKick = stubName.includes('GROUP_PARTICIPANT_REMOVE') && effectiveActor && removedParticipant && extractDigits(effectiveActor) !== extractDigits(removedParticipant)
    return {
      action: isKick ? 'kick' : 'goodbye',
      participants,
      actor: effectiveActor,
      stubName
    }
  }
  return null
}

const maybeHandleWelcomeEvent = async ({ msg, session, chatId, sender }) => {
  if (!chatId.endsWith('@g.us')) return false

  const event = resolveParticipantEvent(msg, sender)
  if (!event || !event.participants.length) return false

  const groupConfig = ensureGroupSettings(chatId)
  if (!groupConfig.welcomeEnabled) return false

  const metadata = await resolveGroupMetadata(session, chatId)
  const subject = metadata?.subject || 'Unbekannte Gruppe'
  const description = String(metadata?.desc || '').trim() || 'Keine Beschreibung gesetzt.'
  const memberCount = Array.isArray(metadata?.participants) ? metadata.participants.length : 0
  const bannerSource = getEventBannerSource(event.action)
  const fallbackBannerUrl = bannerSource ? '' : await resolveProfilePicture(session, chatId)
  const hasAuditLikeData = event.action === 'kick' && !!event.actor
  const reasonText = hasAuditLikeData
    ? 'WhatsApp-Stub erkannt; ein genauer Grund wurde nicht mitgeliefert.'
    : 'kein Grund verfügbar'

  for (const participant of event.participants) {
    const template = getRandomGroupActionTemplate(event.action, groupConfig)
    const text = formatGroupActionTemplate({
      template,
      participant,
      subject,
      description,
      memberCount,
      sessionId: msg.sessionId || DEFAULT_SESSION_NAME,
      moderator: event.actor,
      reason: reasonText
    })

    if (bannerSource || fallbackBannerUrl) {
      try {
        await session.sendMessage(chatId, sanitizeGroupPayload(chatId, {
          image: bannerSource || { url: fallbackBannerUrl },
          caption: text,
          mentions: normalizeMentionList([participant, event.actor])
        }), buildMessageSendOptions())
        continue
      } catch {
        // Fallback auf Text-Nachricht
      }
    }

    await sendТишина(session, chatId, text, {
      mentions: normalizeMentionList([participant, event.actor])
    }).catch((error) => {
      console.error('Gruppenereignis-Nachricht konnte nicht gesendet werden:', error)
    })
  }

  if (event.action === 'welcome') {
    global.db.data.stats.totalWelcomes += event.participants.length
  } else if (event.action === 'kick') {
    global.db.data.stats.totalKicks += event.participants.length
  } else {
    global.db.data.stats.totalGoodbyes += event.participants.length
  }
  await saveDatabase()
  return true
}

const logIncomingMessage = ({ chatId, msg, pushName, parsed }) => {
  const isGroup = chatId.endsWith('@g.us')
  const rawText = String(parsed.text || '').trim()
  const isAiRequest = [getCommandPrefix(), ','].some((prefix) => {
    const body = rawText.startsWith(prefix) ? rawText.slice(prefix.length).trimStart() : ''
    return /^ai(?:\s|$)/i.test(body)
  })
  const lines = [
    `${isGroup ? 'Gruppe' : 'Privat'} · ${parsed.type}`,
    `Session: ${msg.sessionId || 'unbekannt'}`,
    `Von: ${pushName || 'Unbekannt'}`,
    `Zeit: ${formatDateTime(toEpochMs(msg?.messageTimestamp))}`,
    parsed.stubName ? `Stub: ${parsed.stubName}` : null,
    `Inhalt: ${isAiRequest ? '[KI-Anfrage ausgelassen]' : (parsed.text || '[kein Text]')}`
  ].filter(Boolean)

  console.log(boxen(lines.join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: isGroup ? BRAND_COLORS.dustyRose : BRAND_COLORS.steelBlue
  }))
}

const updateCommandStats = (command = '') => {
  global.db.data.stats.totalCommands += 1
  global.db.data.stats.commandUsage[command] = (global.db.data.stats.commandUsage[command] || 0) + 1
}

const buildStartOptions = () => ({
  printQR: runtimeConfig.printQR,
  retryLimit: runtimeConfig.retryLimit
})

const clearQrWaitNotice = (sessionId = '') => {
  const timer = pendingQrWaitNotices.get(sessionId)
  if (timer) clearTimeout(timer)
  pendingQrWaitNotices.delete(sessionId)
}

const scheduleQrWaitNotice = (sessionId = '') => {
  clearQrWaitNotice(sessionId)
  const timer = setTimeout(() => {
    pendingQrWaitNotices.delete(sessionId)
    const info = typeof Тишина?.getSessionInfo === 'function' ? Тишина.getSessionInfo(sessionId) : null
    if (info?.runtimeOnline) return
    const status = String(info?.status || global.db.data.sessions[sessionId]?.state || 'unbekannt')
    const disconnectCode = Number.isFinite(info?.lastDisconnectCode) ? `; Disconnect-Code: ${info.lastDisconnectCode}` : ''
    console.warn(`[WARN] Für ${sessionId} kam nach ${QR_WAIT_NOTICE_MS / 1000}s kein QR-Event an (wa-api-Status: ${status}${disconnectCode}). Der QR kann erst nach erfolgreicher WhatsApp-WebSocket-Verbindung ausgegeben werden; prüfe Netzwerk/Firewall und warte auf einen neuen Versuch.`)
  }, QR_WAIT_NOTICE_MS)
  timer.unref?.()
  pendingQrWaitNotices.set(sessionId, timer)
}

const cleanupQrTargets = () => {
  const now = Date.now()
  for (const [sessionId, target] of pendingQrTargets.entries()) {
    if (!target?.createdAt || now - target.createdAt > QR_PENDING_TTL_MS) {
      pendingQrTargets.delete(sessionId)
    }
  }
}

const rememberQrChatTarget = ({ sessionId = '', chatId = '', sender = '', sourceSessionId = '' } = {}) => {
  const targetSessionId = normalizeSessionName(sessionId)
  if (!targetSessionId || !chatId) return

  cleanupQrTargets()
  pendingQrTargets.set(targetSessionId, {
    chatId,
    sender: normalizeJid(sender),
    sourceSessionId: sourceSessionId ? normalizeSessionName(sourceSessionId) : '',
    createdAt: Date.now()
  })
}

const isSessionSendable = (session = null) => {
  if (!session || typeof session.sendMessage !== 'function') return false
  return getSessionStatus(session) !== 'offline'
}

const findQrBridgeSession = (preferredSessionId = '', excludedSessionId = '') => {
  const excluded = excludedSessionId ? normalizeSessionName(excludedSessionId) : ''
  const preferred = preferredSessionId ? normalizeSessionName(preferredSessionId) : ''
  const candidateIds = unique([
    preferred,
    ...getKnownSessionNames()
  ])

  for (const candidateId of candidateIds) {
    if (!candidateId || candidateId === excluded) continue
    const candidateSession = typeof Тишина?.getSession === 'function' ? Тишина.getSession(candidateId) : null
    if (isSessionSendable(candidateSession)) {
      return { sessionId: candidateId, session: candidateSession }
    }
  }

  return null
}

const createBrandQrBuffer = async (qr = '') => {
  const qrText = String(qr || '').trim()
  if (!qrText) throw new Error('Leerer QR-Code erhalten.')

  return QRCode.toBuffer(qrText, {
    type: 'png',
    errorCorrectionLevel: 'H',
    width: QR_IMAGE_WIDTH,
    margin: 3,
    color: {
      dark: QR_PRIMARY_COLOR,
      light: QR_BACKGROUND_COLOR
    }
  })
}

const printQrToTerminal = async (sessionId = '', qr = '') => {
  const qrText = String(qr || '').trim()
  if (!qrText) throw new Error('Leerer QR-Code für die Terminalausgabe erhalten.')
  const terminalQr = await QRCode.toString(qrText, {
    type: 'terminal',
    small: true,
    errorCorrectionLevel: 'M'
  })
  console.log(chalk.hex(BRAND_COLORS.iceBlue)(`WhatsApp-QR für ${sessionId || DEFAULT_SESSION_NAME}:`))
  console.log(terminalQr)
}

const buildQrCaption = (sessionId = '') => [
  '*🥀 ТИШИНА — VERBINDUNG*',
  '',
  `Session   ${sessionId || DEFAULT_SESSION_NAME}`,
  'Scanne den QR-Code in WhatsApp.',
  'Der Code läuft nach kurzer Zeit ab und wird automatisch erneuert.'
].join('\n')

const sendBrandQrToChat = async ({ session, chatId, qrBuffer, sessionId, mentions = [] } = {}) => {
  if (!session || !chatId || !qrBuffer) return false
  await session.sendMessage(chatId, sanitizeGroupPayload(chatId, {
    image: qrBuffer,
    mimetype: 'image/png',
    caption: buildQrCaption(sessionId),
    ...(mentions.length ? { mentions: normalizeMentionList(mentions) } : {})
  }), buildMessageSendOptions())
  return true
}

const sendQrUpdateToChat = async ({ sessionId = '', qr = '' } = {}) => {
  const targetSessionId = normalizeSessionName(sessionId) || DEFAULT_SESSION_NAME
  cleanupQrTargets()

  const pendingTarget = pendingQrTargets.get(targetSessionId)
  const targets = []

  if (pendingTarget?.chatId) {
    const bridge = findQrBridgeSession(pendingTarget.sourceSessionId, targetSessionId)
    if (bridge) {
      targets.push({
        ...bridge,
        chatId: pendingTarget.chatId,
        mentions: [pendingTarget.sender]
      })
    }
  }

  if (!targets.length && ownerNumbers.length) {
    const bridge = findQrBridgeSession('', targetSessionId)
    if (bridge) {
      for (const ownerJid of ownerNumbers) {
        targets.push({
          ...bridge,
          chatId: ownerJid,
          mentions: []
        })
      }
    }
  }

  if (!targets.length) {
    console.warn(chalk.hex(BRAND_COLORS.dustyRose)(`QR für ${targetSessionId} verfügbar, aber keine verbundene Session zum Chatversand gefunden.`))
    return false
  }

  const qrBuffer = await createBrandQrBuffer(qr)
  const sentTargets = new Set()
  let sent = 0

  for (const target of targets) {
    const key = `${target.sessionId}:${target.chatId}`
    if (sentTargets.has(key)) continue
    sentTargets.add(key)

    try {
      await sendBrandQrToChat({
        session: target.session,
        chatId: target.chatId,
        qrBuffer,
        sessionId: targetSessionId,
        mentions: target.mentions
      })
      sent += 1
    } catch (error) {
      console.error(`QR-Chatversand für ${targetSessionId} fehlgeschlagen:`, error)
    }
  }

  if (sent > 0) {
    console.log(chalk.hex(BRAND_COLORS.iceBlue)(`🥀 QR-Code für ${targetSessionId} wurde an ${sent} Chat(s) gesendet.`))
  }

  return sent > 0
}

const startSessionByQr = async (sessionName = '') => {
  const target = normalizeSessionName(sessionName || DEFAULT_SESSION_NAME)
  const isNewSession = !Object.hasOwn(global.db.data.sessions, target)
  rememberSession(target, {
    state: 'starting',
    desiredState: 'running',
    lastStartedAt: Date.now(),
    lastMethod: 'qr',
    lastError: null
  })
  await saveDatabase()
  console.info(`[INFO] Warte auf WhatsApp-QR für ${target}; der Code erscheint nach erfolgreicher Serververbindung.`)
  scheduleQrWaitNotice(target)
  try {
    await Тишина.startSession(target, buildStartOptions())
  } catch (error) {
    clearQrWaitNotice(target)
    throw error
  }
  console.info(`[INFO] ${target} WhatsApp-Socket initialisiert${isNewSession ? ' (neue Session)' : ''}; warte auf QR- oder Verbindungsereignis.`)
  return target
}

const startSessionByPairing = async (sessionName = '', phoneNumber = '') => {
  const normalizedPhone = extractDigits(phoneNumber)
  if (!/^\d{10,15}$/.test(normalizedPhone)) {
    throw new Error('Bitte eine Telefonnummer mit 10 bis 15 Ziffern angeben.')
  }
  const target = normalizeSessionName(sessionName || DEFAULT_SESSION_NAME)
  rememberSession(target, {
    state: 'starting',
    desiredState: 'running',
    lastStartedAt: Date.now(),
    lastMethod: 'pairing',
    phoneNumber: normalizedPhone,
    lastError: null
  })
  await saveDatabase()
  console.info(`[INFO] ${target} pairing started.`)
  const startedSession = await Тишина.startSessionWithPairingCode(target, {
    ...buildStartOptions(),
    phoneNumber: normalizedPhone
  })
  rememberSession(target, {
    state: getSessionStatus(typeof Тишина?.getSession === 'function' ? Тишина.getSession(target) : startedSession),
    desiredState: 'running',
    lastStartedAt: Date.now(),
    lastMethod: 'pairing',
    phoneNumber: normalizedPhone,
    lastError: null
  })
  await saveDatabase()
  return target
}

const pauseKnownSession = async (sessionName = '') => {
  const target = normalizeSessionName(sessionName)
  if (typeof Тишина.pauseSession !== 'function') throw new Error('pauseSession wird von deiner wa-api aktuell nicht unterstützt.')
  await Тишина.pauseSession(target)
  rememberSession(target, { state: 'paused', desiredState: 'paused', lastError: null })
  await saveDatabase()
  console.info(`[INFO] ${target} paused.`)
  return target
}

const resumeKnownSession = async (sessionName = '') => {
  const target = normalizeSessionName(sessionName)
  if (typeof Тишина.resumeSession !== 'function') throw new Error('resumeSession wird von deiner wa-api aktuell nicht unterstützt.')
  await Тишина.resumeSession(target, buildStartOptions())
  rememberSession(target, { state: 'online', desiredState: 'running', lastError: null })
  await saveDatabase()
  console.info(`[INFO] ${target} resumed.`)
  return target
}

const stopKnownSession = async (sessionName = '') => {
  const target = normalizeSessionName(sessionName)
  if (typeof Тишина.stopSession !== 'function') throw new Error('stopSession wird von deiner wa-api aktuell nicht unterstützt.')
  await Тишина.stopSession(target)
  rememberSession(target, { state: 'offline', desiredState: 'stopped', lastError: null })
  await saveDatabase()
  console.info(`[INFO] ${target} stopped.`)
  return target
}

const deleteKnownSession = async (sessionName = '', sender = '', confirmation = '') => {
  const target = normalizeSessionName(sessionName)
  if (!canManageSessions(sender)) throw new Error('Session-Verwaltung ist Ownern vorbehalten.')
  if (target === DEFAULT_SESSION_NAME && !hasOwnerLevel(sender, 100)) {
    throw new Error('Die Hauptsession darf nur vom Hauptinhaber gelöscht werden.')
  }
  if (target === DEFAULT_SESSION_NAME && confirmation !== 'CONFIRM') {
    throw new Error(`Löschen der Hauptsession gesperrt. Bestätige ausdrücklich mit ",session-delete Maxichen CONFIRM".`)
  }
  if (typeof Тишина.deleteSession !== 'function') throw new Error('deleteSession wird von deiner wa-api aktuell nicht unterstützt.')
  await Тишина.deleteSession(target)
  delete global.db.data.sessions[target]
  await saveDatabase()
  console.info(`[INFO] ${target} deleted.`)
  return target
}

const isSessionAlreadyRegistered = (sessionName = '') => {
  const target = normalizeSessionName(sessionName)
  const liveSession = typeof Тишина?.getSession === 'function' ? Тишина.getSession(target) : null
  return Object.hasOwn(global.db.data.sessions, target)
    || Boolean(liveSession)
    || listExistingCredentialDirectories(target).length > 0
}

const bootstrapConfiguredSessions = async () => {
  const configured = unique([
    ...runtimeConfig.bootstrapSessions,
    ...Object.entries(global.db.data.sessions || {})
      .filter(([, entry]) => entry?.desiredState === 'running')
      .map(([sessionName]) => sessionName)
  ])

  if (!configured.length) {
    const fallback = DEFAULT_SESSION_NAME
    await startSessionByQr(fallback)
    console.log(chalk.hex(BRAND_COLORS.iceBlue)(`Fallback-Session gestartet: ${fallback}`))
    return
  }

  for (const sessionName of configured) {
    try {
      await startSessionByQr(sessionName)
      console.log(chalk.hex(BRAND_COLORS.iceBlue)(`Session gestartet: ${sessionName}`))
    } catch (error) {
      rememberSession(sessionName, { state: 'offline', lastError: error.message, desiredState: 'running' })
      await saveDatabase()
      console.error(chalk.hex(BRAND_COLORS.dustyRose)(`Session-Start für ${sessionName} fehlgeschlagen:`), error)
    }
  }
}

const printStartupBox = () => {
  const ownerLine = primaryOwner.name
  const bootstrapLine = runtimeConfig.bootstrapSessions.length ? runtimeConfig.bootstrapSessions.join(', ') : 'keine'

  console.log(boxen([
    chalk.bold.hex(BRAND_COLORS.softWhite)('Т И Ш И Н А'),
    chalk.hex(BRAND_COLORS.iceBlue)('A quiet voice in a noisy world.'),
    `Version: ${packageMeta.version} • By ${ownerConfig.ownerName}`,
    '',
    `Prefix   ${chalk.hex(BRAND_COLORS.iceBlue)(getCommandPrefix())}`,
    `Terminal-QR   ${runtimeConfig.printQR ? 'aktiv' : 'inaktiv'}`,
    `Dry-Run   ${runtimeConfig.dryRun ? 'aktiv' : 'inaktiv'}`,
    `Owner   ${ownerLine}`,
    `Sessions   ${bootstrapLine}`,
    '',
    'Stille • Sehnsucht • Erinnerungen • Hoffnung • Neuanfang'
  ].join('\n'), {
    padding: 1,
    borderStyle: 'round',
    borderColor: BRAND_COLORS.steelBlue
  }))
}

const askQuestion = async (rl, question) => new Promise((resolve) => {
  rl.question(question, (answer) => resolve(String(answer || '').trim()))
})

if (typeof Тишина?.onQRUpdated === 'function') {
  Тишина.onQRUpdated(async ({ sessionId = DEFAULT_SESSION_NAME, qr = '' } = {}) => {
    const targetSessionId = normalizeSessionName(sessionId)
    clearQrWaitNotice(targetSessionId)
    publishPublicStatus()
    try {
      if (runtimeConfig.printQR) await printQrToTerminal(targetSessionId, qr)
      await sendQrUpdateToChat({ sessionId: targetSessionId, qr })
    } catch (error) {
      console.error(`QR-Code für ${targetSessionId} konnte nicht verarbeitet werden:`, error)
    }
  })
}

if (typeof Тишина?.onConnected === 'function') {
  Тишина.onConnected(async (sessionId = '') => {
    let targetSessionId
    try {
      targetSessionId = normalizeSessionName(sessionId)
    } catch (error) {
      console.error('WhatsApp-Verbindung mit ungültiger Session-ID gemeldet:', error.message)
      return
    }
    clearQrWaitNotice(targetSessionId)
    pendingQrTargets.delete(targetSessionId)
    rememberSession(targetSessionId, { state: 'online', desiredState: 'running', lastError: null })
    await saveDatabase().catch((error) => console.error(`Sessionstatus für ${targetSessionId} konnte nicht gespeichert werden:`, error.message))
    console.info(`[INFO] ${targetSessionId} connected.`)
    publishPublicStatus()
  })
}

if (typeof Тишина?.onConnecting === 'function') {
  Тишина.onConnecting(async (sessionId = '') => {
    try {
      const targetSessionId = normalizeSessionName(sessionId)
      rememberSession(targetSessionId, { state: 'connecting', desiredState: 'running' })
      await saveDatabase()
    } catch (error) {
      console.error('Session-Verbindungsstatus konnte nicht gespeichert werden:', error.message)
    }
    publishPublicStatus()
  })
}

if (typeof Тишина?.onDisconnected === 'function') {
  Тишина.onDisconnected(async (sessionId = '') => {
    try {
      const targetSessionId = normalizeSessionName(sessionId)
      clearQrWaitNotice(targetSessionId)
      const existing = global.db.data.sessions[targetSessionId]
      const intentional = ['paused', 'stopped'].includes(existing?.desiredState)
      const state = existing?.desiredState === 'paused' ? 'paused' : 'offline'
      rememberSession(targetSessionId, { state, lastError: existing?.lastError || null })
      await saveDatabase()
      const log = intentional ? console.info : console.warn
      log(`[${intentional ? 'INFO' : 'WARN'}] ${targetSessionId} disconnected.`)
    } catch (error) {
      console.error('Session-Trennung konnte nicht protokolliert werden:', error.message)
    }
    publishPublicStatus()
  })
}
const startRuntime = async () => {
  printStartupBox()

  if (runtimeConfig.dryRun) {
    console.log(chalk.hex(BRAND_COLORS.steelBlue)('Dry-Run aktiv – es wird keine echte WhatsApp-Session gestartet.'))
    return
  }

  const isInteractive = !!(input.isTTY && output.isTTY)
  if (!isInteractive) {
    await bootstrapConfiguredSessions()
    return
  }

  const rl = readline.createInterface({ input, output })
  try {
    console.log(chalk.hex(BRAND_COLORS.steelBlue)('1) QR-Verbindung • 2) Pairing-Code • 3) Sessions starten'))
    const choice = await askQuestion(rl, chalk.hex(BRAND_COLORS.iceBlue)('Auswahl (1/2/3): '))

    if (choice === '1') {
      const fallback = runtimeConfig.bootstrapSessions[0] || DEFAULT_SESSION_NAME
      const enteredSessionName = await askQuestion(rl, chalk.hex(BRAND_COLORS.iceBlue)(`Session-ID [${fallback}]: `))
      const sessionName = normalizeSessionName(enteredSessionName || fallback) || fallback
      await startSessionByQr(sessionName)
      console.log(chalk.hex(BRAND_COLORS.iceBlue)(`Session gestartet; QR wird angezeigt, sobald WhatsApp ihn sendet: ${sessionName}`))
      return
    }

    if (choice === '2') {
      const fallback = runtimeConfig.bootstrapSessions[0] || DEFAULT_SESSION_NAME
      const enteredSessionName = await askQuestion(rl, chalk.hex(BRAND_COLORS.iceBlue)(`Session-ID [${fallback}]: `))
      const sessionName = normalizeSessionName(enteredSessionName || fallback) || fallback
      const phoneNumber = await askQuestion(rl, chalk.hex(BRAND_COLORS.iceBlue)('Telefonnummer (internationales Format): '))
      await startSessionByPairing(sessionName, phoneNumber)
      console.log(chalk.hex(BRAND_COLORS.iceBlue)(`Pairing gestartet: ${sessionName}`))
      return
    }

    await bootstrapConfiguredSessions()
  } finally {
    rl.close()
  }
}

Тишина.onMessageReceived(async (msg) => {
  try {
    const { key, pushName } = msg
    const chatId = key?.remoteJid
    if (!chatId) return

    const session = typeof Тишина?.getSession === 'function' ? Тишина.getSession(msg.sessionId) : null
    if (!session) return

    const parsed = parseIncomingMessage(msg)
    logIncomingMessage({ chatId, msg, pushName, parsed })

    global.db.data.stats.totalMessages += 1

    const senderId = normalizeJid(key?.participant || key?.remoteJid || msg?.participant || '')
    const alternateSenderId = normalizeJid(
      key?.participantAlt
      || key?.participant_pn
      || key?.remoteJidAlt
      || key?.remoteJidUsername
      || ''
    )
    const sender = getOwnerBySender(senderId)
      ? senderId
      : (getOwnerBySender(alternateSenderId) ? alternateSenderId : senderId)
    const senderJids = unique([senderId, alternateSenderId])
    if (!sender) {
      console.error('Kein gültiger Absender in der Nachricht gefunden.')
      return
    }

    const user = ensureUser(sender, pushName)

    await maybeHandleWelcomeEvent({
      msg,
      session,
      chatId,
      sender
    })

    const normalizedText = normalizeInteractiveCommand(parsed.text, parsed.type)
    const configuredPrefix = getCommandPrefix()
    const commandPrefix = normalizedText.startsWith(configuredPrefix)
      ? configuredPrefix
      : (normalizedText.startsWith(',') ? ',' : '')
    if (!commandPrefix) {
      return
    }

    const withoutPrefix = normalizedText.slice(commandPrefix.length).trim()
    if (!withoutPrefix) return

    const [rawCommand, ...rest] = withoutPrefix.split(/\s+/)
    const command = normalizeCommand(rawCommand)
    const args = rest
    const sessionId = msg.sessionId ? normalizeSessionName(msg.sessionId) : DEFAULT_SESSION_NAME

    if (global.db.data.settings.maintenance && !isOwner(sender)) {
      await sendТишина(session, chatId, '*🥀 ТИШИНА — WARTUNG*\n\nDer Bot ist vorübergehend im Wartungsmodus. Bitte versuche es später erneut.', { quoted: msg })
      return
    }

    const requireOwnerAccess = async (requiredLevel = 90) => {
      if (hasOwnerLevel(sender, requiredLevel)) return true
      await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
      return false
    }

    let commandHandled = false

    switch (command) {
      case 'menu': {
        commandHandled = true
        const state = getMenuSession(chatId, sender)
        const requested = String(args[0] || '').trim().toUpperCase()
        if (Object.hasOwn(MENU_CATEGORIES, requested)) {
          if (requested === 'ADMINISTRATION' && !isOwner(sender)) {
            await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
            break
          }
          state.selectedCategory = requested
          state.page = Object.keys(MENU_CATEGORIES).indexOf(requested)
        } else if (requested === 'NEXT' && state.selectedCategory) {
          const nextCategory = getNextMenuCategoryId(state.selectedCategory, {
            includeAdministration: isOwner(sender)
          })
          state.selectedCategory = nextCategory
          state.page = Object.keys(MENU_CATEGORIES).indexOf(nextCategory)
        } else if (requested === 'BACK' || requested === 'ZURÜCK') {
          if (state.selectedCategory) {
            state.page = 0
            state.selectedCategory = null
          }
        } else {
          state.page = 0
          state.selectedCategory = null
        }
        await renderInteractiveMenu({ session, chatId, sender, quoted: msg })
        break
      }

      case 'help': {
        commandHandled = true
        await sendТишина(session, chatId, buildHelpText(), { quoted: msg })
        break
      }

      case 'ping': {
        commandHandled = true
        const latency = Date.now() - toEpochMs(msg.messageTimestamp)
        await sendТишина(session, chatId, [
          '*🥀 ТИШИНА — SYSTEM STATUS*',
          '',
          `WhatsApp   ${formatSessionStatusBadge(getSessionStatus(session))}`,
          `Antwortzeit   ${Math.max(0, latency)} ms`,
          `Session   ${sessionId}`,
          `Laufzeit   ${formatDuration(Date.now() - BOOT_AT)}`,
          '',
          `— Version ${packageMeta.version}`
        ].join('\n'), { quoted: msg })
        break
      }

      case 'uptime': {
        commandHandled = true
        await sendТишина(session, chatId, [
          '*🥀 ТИШИНА — LAUFZEIT*',
          '',
          `Laufzeit   ${formatDuration(Date.now() - BOOT_AT)}`,
          `Gestartet   ${formatDateTime(BOOT_AT)}`,
          `Session   ${sessionId}`,
          `Nachrichten   ${global.db.data.stats.totalMessages}`,
          `Befehle   ${global.db.data.stats.totalCommands}`,
          '',
          `— By ${ownerConfig.ownerName}`
        ].join('\n'), { quoted: msg })
        break
      }

      case 'about': {
        commandHandled = true
        await sendТишина(session, chatId, buildAboutText(), { quoted: msg })
        break
      }

      case 'status': {
        commandHandled = true
        await sendТишина(session, chatId, [
          '*🥀 ТИШИНА — SYSTEM STATUS*',
          '',
          `WhatsApp   ${formatSessionStatusBadge(getLiveWhatsAppStatus())}`,
          'Webserver   erreichbar',
          `Version   ${packageMeta.version}`,
          `KI   ${runtimeConfig.ai.configured && global.db.data.settings.aiEnabled ? 'aktiviert' : 'deaktiviert'}`,
          `Wartung   ${global.db.data.settings.maintenance ? 'aktiv' : 'inaktiv'}`
        ].join('\n'), { quoted: msg })
        break
      }

      case 'version': {
        commandHandled = true
        await sendТишина(session, chatId, `*🥀 ТИШИНА — VERSION*\n\n${packageMeta.version}`, { quoted: msg })
        break
      }

      case 'website': {
        commandHandled = true
        await sendТишина(session, chatId, `*🥀 ТИШИНА — WEBSITE*\n\n${BOT_OWNER_INFO.website}`, { quoted: msg })
        break
      }

      case 'quote': {
        commandHandled = true
        const quotes = [
          '«Иногда тишина говорит больше, чем тысяча слов.»\nManchmal sagt die Stille mehr als tausend Worte.',
          'Manche Erinnerungen sind wie Regen: leise, aber sie bleiben.',
          'Auch die längste Nacht verliert irgendwann ihre Dunkelheit.'
        ]
        await sendТишина(session, chatId, `🥀 ${pickRandom(quotes, quotes[0])}`, { quoted: msg })
        break
      }

      case 'random': {
        commandHandled = true
        const thoughts = [
          'Ein kleiner Anfang ist immer noch ein Anfang.',
          'Heute darf es langsam gehen.',
          'Du musst nicht alles auf einmal lösen.'
        ]
        await sendТишина(session, chatId, pickRandom(thoughts, thoughts[0]), { quoted: msg })
        break
      }

      case 'fact': {
        commandHandled = true
        const facts = [
          'Schall breitet sich in kalter Luft langsamer aus als in warmer Luft.',
          'Schnee reflektiert einen großen Teil des sichtbaren Lichts.',
          'Der Mond leuchtet nicht selbst, sondern reflektiert Sonnenlicht.'
        ]
        await sendТишина(session, chatId, pickRandom(facts, facts[0]), { quoted: msg })
        break
      }

      case 'ai': {
        commandHandled = true
        const action = String(args[0] || '').trim().toLowerCase()
        if (action === 'on' || action === 'off') {
          if (!await requireOwnerAccess()) break
          if (action === 'on' && !runtimeConfig.ai.configured) {
            await sendТишина(session, chatId, 'Die KI bleibt deaktiviert. Bitte konfiguriere AI_PROVIDER, AI_API_KEY und AI_MODEL in der lokalen `.env`.', { quoted: msg })
            break
          }
          global.db.data.settings.aiEnabled = action === 'on'
          global.db.data.settings.aiEnabledOverridden = true
          await saveDatabase()
          publishPublicStatus()
          await sendТишина(session, chatId, `*🥀 ТИШИНА — KI ${action === 'on' ? 'AKTIVIERT' : 'DEAKTIVIERT'}*\n\n${action === 'on' ? 'Antworten erfolgen nur nach einer ausdrücklichen ,ai-Anfrage.' : 'Die optionale KI ist ausgeschaltet.'}`, { quoted: msg })
          break
        }

        if (action === 'status') {
          const enabled = runtimeConfig.ai.configured && global.db.data.settings.aiEnabled
          const usage = getAiUsage(sender)
          await sendТишина(session, chatId, [
            '*🥀 ТИШИНА — KI-STATUS*',
            '',
            `Konfiguration   ${runtimeConfig.ai.configured ? 'vollständig' : 'fehlt'}`,
            `Status   ${enabled ? 'aktiviert' : 'deaktiviert'}`,
            `Tageslimit   ${usage.count} / ${runtimeConfig.ai.dailyLimit}`,
            'Anfragen werden nicht als Chatverlauf gespeichert.'
          ].join('\n'), { quoted: msg })
          break
        }

        if (!args.length) {
          await sendТишина(session, chatId, buildAiHelpText(), { quoted: msg })
          break
        }

        const prompt = args.join(' ').trim()
        if (prompt.length > 2000) {
          await sendТишина(session, chatId, 'Bitte kürze deine Anfrage auf höchstens 2000 Zeichen.', { quoted: msg })
          break
        }
        try {
          const answer = await generateAiAnswer(sender, prompt)
          await sendТишина(session, chatId, answer, { quoted: msg, aiGenerated: true })
        } catch (error) {
          if (error.code === 'AI_NOT_CONFIGURED' || error.code === 'AI_DISABLED') {
            await sendТишина(session, chatId, 'Die optionale KI ist momentan nicht verfügbar. Nutze `,ai status` für weitere Informationen.', { quoted: msg })
          } else if (error.code === 'AI_DAILY_LIMIT') {
            await sendТишина(session, chatId, `Das tägliche KI-Limit von ${runtimeConfig.ai.dailyLimit} Anfragen ist erreicht.`, { quoted: msg })
          } else if (error.code === 'AI_EMPTY_PROMPT') {
            await sendТишина(session, chatId, buildAiHelpText(), { quoted: msg })
          } else {
            console.error('KI-Anfrage fehlgeschlagen:', error.code || error.name || 'unbekannter Fehler')
            await sendТишина(session, chatId, 'Die KI-Antwort konnte gerade nicht erstellt werden. Bitte versuche es später erneut.', { quoted: msg })
          }
        }
        break
      }

      case 'rules': {
        commandHandled = true
        await sendТишина(session, chatId, buildRulesText(), { quoted: msg })
        break
      }

      case 'support': {
        commandHandled = true
        await sendТишина(session, chatId, buildSupportText(), { quoted: msg })
        break
      }

      case 'ownercontact': {
        commandHandled = true
        await sendТишина(session, chatId, [
          '*🥀 ТИШИНА — KONTAKT*',
          '',
          `Name   ${ownerConfig.ownerName}`,
          `Website   ${BOT_OWNER_INFO.website}`,
          `Owner   ${owners.filter((owner) => owner.enabled).length}`,
          '',
          `— By ${ownerConfig.ownerName}`
        ].join('\n'), { quoted: msg })
        break
      }

      case 'prefix': {
        commandHandled = true
        await sendТишина(session, chatId, [
          '*🥀 ТИШИНА — PREFIX*',
          '',
          `Aktuell   ${getCommandPrefix()}`,
          `Ändern   ${canManageSessions(sender) ? 'freigegeben' : 'nur für Owner'}`,
          `Beispiel   \`${getCommandPrefix()}setprefix #\``
        ].join('\n'), { quoted: msg })
        break
      }

      case 'setprefix': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }

        const nextPrefix = String(args[0] || '').trim()
        if (!nextPrefix || /\s/.test(nextPrefix) || nextPrefix.length > 5) {
          await sendТишина(session, chatId, 'Bitte gib einen Prefix mit höchstens 5 Zeichen und ohne Leerzeichen an.\n\nBeispiel: `!setprefix #`', { quoted: msg })
          break
        }

        global.db.data.settings.prefix = nextPrefix
        runtimeConfig.botPrefix = nextPrefix
        await saveDatabase()
        await sendТишина(session, chatId, `*🥀 ТИШИНА — PREFIX AKTUALISIERT*\n\nNeuer Prefix   ${nextPrefix}\n\nTeste ihn mit \`${nextPrefix}menu\`.`, { quoted: msg })
        break
      }

      case 'plugins': {
        commandHandled = true
        await sendТишина(session, chatId, buildPluginsText(), { quoted: msg })
        break
      }

      case 'stats': {
        commandHandled = true
        await sendТишина(session, chatId, buildStatsText(), { quoted: msg })
        break
      }

      case 'register': {
        commandHandled = true
        const displayName = args.join(' ').trim() || pushName || user.name || 'Unbekannt'
        user.registered = true
        user.name = displayName
        user.registeredAt = Date.now()
        user.pushName = pushName || user.pushName || null
        await saveDatabase()
        await sendТишина(session, chatId, [
          '*🥀 ТИШИНА — PROFIL ANGELEGT*',
          '',
          `Name   ${user.name}`,
          `Level   ${user.level}`,
          `Erfahrung   ${user.xp}`,
          `Seit   ${formatDateTime(user.registeredAt)}`,
          '',
          'Schön, dass du hier bist.',
          '',
          `— By ${ownerConfig.ownerName}`
        ].join('\n'), { quoted: msg })
        break
      }

      case 'me': {
        commandHandled = true
        const profilePic = await resolveProfilePicture(session, sender)
        const profileText = [
          '*🥀 ТИШИНА — DEIN PROFIL*',
          '',
          `Name   ${user.name || pushName || 'Unbekannt'}`,
          `Status   ${user.registered ? 'registriert' : 'nicht registriert'}`,
          `Level   ${user.level}`,
          `Erfahrung   ${user.xp}`,
          `Befehle   ${user.commandCount || 0}`,
          `Erstellt   ${formatDateTime(user.createdAt)}`,
          `Zuletzt gesehen   ${formatDateTime(user.lastSeenAt)}`,
          '',
          `— By ${ownerConfig.ownerName}`
        ].join('\n')

        if (profilePic) {
          try {
            await session.sendMessage(chatId, sanitizeGroupPayload(chatId, {
              image: { url: profilePic },
              caption: profileText
            }), buildMessageSendOptions({ quoted: msg }))
            break
          } catch {
            // Fallback auf Text
          }
        }

        await sendТишина(session, chatId, profileText, { quoted: msg })
        break
      }

      case 'owner': {
        commandHandled = true
        if (!await requireOwnerAccess()) break
        await sendТишина(session, chatId, buildOwnerText(), { quoted: msg })
        break
      }

      case 'ownerlist': {
        commandHandled = true
        if (!await requireOwnerAccess()) break
        await sendТишина(session, chatId, buildOwnerListText(), { quoted: msg })
        break
      }

      case 'botinfo': {
        commandHandled = true
        if (!await requireOwnerAccess()) break
        await sendТишина(session, chatId, buildBotInfoText(), { quoted: msg })
        break
      }

      case 'botstatus': {
        commandHandled = true
        if (!await requireOwnerAccess()) break
        await sendТишина(session, chatId, buildBotStatusText(sessionId, session), { quoted: msg })
        break
      }

      case 'maintenance': {
        commandHandled = true
        if (!await requireOwnerAccess()) break

        const action = String(args[0] || 'status').trim().toLowerCase()
        if (action === 'on' || action === 'off') {
          global.db.data.settings.maintenance = action === 'on'
          await saveDatabase()
        } else if (action !== 'status') {
          await sendТишина(session, chatId, 'Verwendung: `,maintenance on|off|status`', { quoted: msg })
          break
        }

        await sendТишина(session, chatId, `*🥀 ТИШИНА — WARTUNGSMODUS*\n\nStatus   ${global.db.data.settings.maintenance ? 'aktiv' : 'inaktiv'}`, { quoted: msg })
        break
      }

      case 'logs': {
        commandHandled = true
        if (!await requireOwnerAccess(100)) break
        if (chatId.endsWith('@g.us')) {
          await sendТишина(session, chatId, 'Das Fehlerprotokoll ist nur im privaten Chat verfügbar.', { quoted: msg })
          break
        }
        await sendТишина(session, chatId, `*🥀 ТИШИНА — FEHLERPROTOKOLL*\n\n${readRecentErrorLogs()}`, { quoted: msg })
        break
      }

      case 'restart': {
        commandHandled = true
        if (!await requireOwnerAccess(100)) break
        if (chatId.endsWith('@g.us')) {
          await sendТишина(session, chatId, 'Ein Neustart kann nur im privaten Chat angefordert werden.', { quoted: msg })
          break
        }
        if (process.env.pm_id === undefined) {
          await sendТишина(session, chatId, 'Ein automatischer Neustart ist nur möglich, wenn Тишина unter PM2 läuft.', { quoted: msg })
          break
        }
        await sendТишина(session, chatId, '*🥀 ТИШИНА — NEUSTART*\n\nDer Neustart wird ausgeführt.', { quoted: msg })
        await saveDatabase()
        setTimeout(() => process.kill(process.pid, 'SIGINT'), 250).unref()
        break
      }

      case 'tagall': {
        commandHandled = true
        if (!chatId.endsWith('@g.us')) {
          await sendТишина(session, chatId, '`tagall` ist nur in Gruppen verfügbar.', { quoted: msg })
          break
        }

        const { metadata, error: metadataError } = await fetchFreshGroupMetadata(session, chatId)
        const participants = Array.isArray(metadata?.participants) ? metadata.participants : []
        if (!participants.length) {
          if (metadataError) console.warn(`tagall konnte Gruppenmitglieder in ${chatId} nicht laden:`, metadataError.message)
          await sendТишина(session, chatId, 'Die Gruppenmitglieder konnten nicht geladen werden. Bitte versuche es später erneut.', { quoted: msg })
          break
        }

        if (!isAuthorizedTagAll({ participants, senderJids, isOwner: isOwner(sender) })) {
          await sendТишина(session, chatId, '> ⛔ *Zugriff verweigert:* Nur Owner oder Gruppen-Admins dürfen alle Mitglieder erwähnen.', { quoted: msg })
          break
        }

        const cooldownUntil = tagAllCooldowns.get(chatId) || 0
        if (cooldownUntil > Date.now()) {
          const secondsLeft = Math.ceil((cooldownUntil - Date.now()) / 1000)
          await sendТишина(session, chatId, `${getCommandPrefix()}tagall ist zum Schutz der Gruppe noch ${secondsLeft} Sekunden abgekühlt.`, { quoted: msg })
          break
        }

        const ownJids = [getSessionOwnJid(session) || session?.user?.lid || session?.authState?.creds?.me?.lid]
        const { mentions, skipped } = collectTagAllMentions(participants, ownJids)
        if (skipped) console.warn(`tagall hat ${skipped} Gruppenmitglied(er) ohne unterstützte PN-/LID-Kennung übersprungen in ${chatId}.`)
        if (!mentions.length) {
          await sendТишина(session, chatId, 'Es wurden keine gültigen PN- oder LID-Kennungen für Erwähnungen gefunden.', { quoted: msg })
          break
        }

        const message = buildTagAllMessage(mentions, {
          ownerName: ownerConfig.ownerName,
          announcement: args.join(' ')
        })
        tagAllCooldowns.set(chatId, Date.now() + TAGALL_COOLDOWN_MS)
        try {
          await sendТишина(session, chatId, message, { quoted: msg })
        } catch (error) {
          console.error(`${getCommandPrefix()}tagall konnte nicht an ${chatId} gesendet werden:`, error)
          await sendТишина(session, chatId, 'Die Erwähnungen konnten nicht vollständig gesendet werden. Bitte warte vor einem erneuten Versuch die Gruppen-Schutzpause ab.', { quoted: msg })
        }
        break
      }

      case 'groupinfo': {
        commandHandled = true
        if (!chatId.endsWith('@g.us')) {
          await sendТишина(session, chatId, '`groupinfo` ist nur in Gruppen verfügbar.', { quoted: msg })
          break
        }

        const metadata = await resolveGroupMetadata(session, chatId)
        if (!metadata) {
          await sendТишина(session, chatId, 'Die Gruppeninformationen konnten gerade nicht geladen werden.', { quoted: msg })
          break
        }

        const participants = Array.isArray(metadata.participants) ? metadata.participants : []
        const admins = participants.filter((participant) => participant?.admin === 'admin' || participant?.admin === 'superadmin')
        const groupCaption = [
          `*🥀 ${metadata.subject || 'GRUPPENINFORMATION'}*`,
          '',
          `Mitglieder   ${participants.length}`,
          `Admins   ${admins.length}`,
          `Session   ${sessionId}`,
          '',
          String(metadata.desc || 'Keine Beschreibung gesetzt.').trim() || 'Keine Beschreibung gesetzt.'
        ].join('\n')

        const groupPicture = await resolveProfilePicture(session, chatId)
        if (groupPicture) {
          try {
            await session.sendMessage(chatId, sanitizeGroupPayload(chatId, {
              image: { url: groupPicture },
              caption: groupCaption
            }), buildMessageSendOptions({ quoted: msg }))
            break
          } catch {
            // Fallback auf Text
          }
        }

        await sendТишина(session, chatId, groupCaption, { quoted: msg })
        break
      }

      case 'addmeta':
      case 'kickmeta': {
        commandHandled = true
        if (!chatId.endsWith('@g.us')) {
          await sendТишина(session, chatId, `\`${command}\` funktioniert nur in Gruppen.`, { quoted: msg })
          break
        }

        await manageMetaAiInGroup({
          session,
          chatId,
          sender,
          senderJids,
          quoted: msg,
          action: command === 'addmeta' ? 'add' : 'remove'
        })
        break
      }

      case 'welcome': {
        commandHandled = true
        if (!chatId.endsWith('@g.us')) {
          await sendТишина(session, chatId, '`welcome` ist nur in Gruppen verfügbar.', { quoted: msg })
          break
        }

        const groupConfig = ensureGroupSettings(chatId)
        const metadata = await resolveGroupMetadata(session, chatId)
        const subject = metadata?.subject || 'dieser Gruppe'
        const subCommand = String(args[0] || 'status').trim().toLowerCase()
        const restText = args.slice(1).join(' ').trim()

        if (subCommand === 'on') {
          groupConfig.welcomeEnabled = true
          groupConfig.updatedAt = Date.now()
          await saveDatabase()
          await sendТишина(session, chatId, `*🥀 ТИШИНА — BEGRÜSSUNGEN AKTIV*\n\n${subject}`, { quoted: msg })
          break
        }

        if (subCommand === 'off') {
          groupConfig.welcomeEnabled = false
          groupConfig.updatedAt = Date.now()
          await saveDatabase()
          await sendТишина(session, chatId, `*🥀 ТИШИНА — BEGRÜSSUNGEN INAKTIV*\n\n${subject}`, { quoted: msg })
          break
        }

        if (subCommand === 'set') {
          if (!restText) {
            await sendТишина(session, chatId, 'Bitte gib nach `welcome set` einen Begrüßungstext an.', { quoted: msg })
            break
          }
          groupConfig.welcomeTemplate = restText
          groupConfig.updatedAt = Date.now()
          await saveDatabase()
          await sendТишина(session, chatId, 'Begrüßungstext wurde gespeichert.', { quoted: msg })
          break
        }

        if (subCommand === 'setbye') {
          if (!restText) {
            await sendТишина(session, chatId, 'Bitte gib nach `welcome setbye` einen Abschiedstext an.', { quoted: msg })
            break
          }
          groupConfig.goodbyeTemplate = restText
          groupConfig.updatedAt = Date.now()
          await saveDatabase()
          await sendТишина(session, chatId, 'Abschiedstext wurde gespeichert.', { quoted: msg })
          break
        }

        if (subCommand === 'setkick') {
          if (!restText) {
            await sendТишина(session, chatId, 'Bitte gib nach `welcome setkick` einen Moderationstext an.', { quoted: msg })
            break
          }
          groupConfig.kickTemplate = restText
          groupConfig.updatedAt = Date.now()
          await saveDatabase()
          await sendТишина(session, chatId, 'Moderationstext wurde gespeichert.', { quoted: msg })
          break
        }

        if (subCommand === 'reset') {
          groupConfig.welcomeTemplate = DEFAULT_WELCOME_TEMPLATE
          groupConfig.goodbyeTemplate = DEFAULT_GOODBYE_TEMPLATE
          groupConfig.kickTemplate = DEFAULT_KICK_TEMPLATE
          groupConfig.updatedAt = Date.now()
          await saveDatabase()
          await sendТишина(session, chatId, 'Die Begrüßungs-, Abschieds- und Moderationstexte wurden auf den Тишина-Stil zurückgesetzt.', { quoted: msg })
          break
        }

        if (subCommand === 'preview' || subCommand === 'test') {
          const participant = sender
          const memberCount = Array.isArray(metadata?.participants) ? metadata.participants.length : 0
          const previewText = formatWelcomeTemplate({
            template: groupConfig.welcomeTemplate,
            participant,
            subject,
            description: String(metadata?.desc || '').trim() || 'Keine Beschreibung gesetzt.',
            memberCount,
            sessionId
          })
          await sendТишина(session, chatId, previewText, { quoted: msg, mentions: [participant] })
          break
        }

        await sendТишина(session, chatId, buildWelcomeStatusText(groupConfig, subject), { quoted: msg })
        break
      }

      case 'session-info': {
        commandHandled = true
        let target = sessionId
        try {
          if (args[0]) {
            target = normalizeSessionName(args[0])
            if (target !== sessionId && !canManageSessions(sender)) {
              await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
              break
            }
          }
          const targetSession = typeof Тишина?.getSession === 'function' ? Тишина.getSession(target) : null
          await sendТишина(session, chatId, buildSessionInfoText(target, targetSession, sender, chatId), { quoted: msg })
        } catch (error) {
          await sendТишина(session, chatId, `*🥀 ТИШИНА — SESSION-INFO FEHLGESCHLAGEN*\n\n${error.message}`, { quoted: msg })
        }
        break
      }

      case 'sessions': {
        commandHandled = true
        await sendТишина(session, chatId, buildSessionsText(sessionId), { quoted: msg })
        break
      }

      case 'session-start': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }

        let target = ''
        try {
          target = normalizeSessionName(args[0] || sessionId || runtimeConfig.bootstrapSessions[0] || DEFAULT_SESSION_NAME)
          if (isSessionAlreadyRegistered(target)) {
            const duplicateError = new Error(`"${target}" ist bereits registriert. Verwende ,session-resume ${target.slice(SESSION_PREFIX.length)} zum Fortsetzen.`)
            duplicateError.code = 'SESSION_ALREADY_REGISTERED'
            throw duplicateError
          }
          rememberQrChatTarget({
            sessionId: target,
            chatId,
            sender,
            sourceSessionId: sessionId
          })
          await startSessionByQr(target)
          await sendТишина(session, chatId, `*🥀 ТИШИНА — VERBINDUNG WIRD VORBEREITET*\n\nSession   ${target}\n\nWenn WhatsApp einen QR-Code bereitstellt, erscheint er hier im passenden Тишина-Farbton.`, { quoted: msg })
        } catch (error) {
          if (error.code !== 'SESSION_ALREADY_REGISTERED' && target) {
            rememberSession(target, { state: 'error', lastError: error.message, desiredState: 'stopped' })
            await saveDatabase()
            console.warn(`[WARN] ${target} QR start failed: ${error.message}`)
          }
          await sendТишина(session, chatId, `*🥀 ТИШИНА — SESSION-START FEHLGESCHLAGEN*\n\nSession   ${target || 'ungültig'}\nGrund   ${error.message}`, { quoted: msg })
        }
        break
      }

      case 'session-pair': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }
        if (typeof Тишина.startSessionWithPairingCode !== 'function') {
          await sendТишина(session, chatId, 'Deine wa-api-Version unterstützt aktuell keinen Pairing-Code-Start.', { quoted: msg })
          break
        }

        const maybePhone = args.length === 1 ? args[0] : args[1]
        const maybeSession = args.length === 1 ? sessionId : args[0]
        let target = ''
        try {
          target = normalizeSessionName(maybeSession || sessionId || DEFAULT_SESSION_NAME)
          if (isSessionAlreadyRegistered(target)) {
            throw new Error(`"${target}" ist bereits registriert. Pairing benötigt einen neuen Sessionnamen.`)
          }
          await startSessionByPairing(target, maybePhone)
          await sendТишина(session, chatId, `*🥀 ТИШИНА — PAIRING GESTARTET*\n\nSession   ${target}\n\nVerwende eine vollständige Telefonnummer im internationalen Format.`, { quoted: msg })
        } catch (error) {
          if (target && !isSessionAlreadyRegistered(target)) {
            rememberSession(target, { state: 'error', lastError: error.message, desiredState: 'stopped' })
            await saveDatabase()
          }
          console.warn(`[WARN] ${target || 'Ungültige Session'} pairing failed: ${error.message}`)
          await sendТишина(session, chatId, `*🥀 ТИШИНА — PAIRING FEHLGESCHLAGEN*\n\nSession   ${target || 'ungültig'}\nGrund   ${error.message}`, { quoted: msg })
        }
        break
      }

      case 'session-pause': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }

        let target = ''
        try {
          target = normalizeSessionName(args[0] || sessionId)
          await pauseKnownSession(target)
          await sendТишина(session, chatId, `Session *${target}* ist jetzt pausiert.`, { quoted: msg })
        } catch (error) {
          await sendТишина(session, chatId, `*🥀 ТИШИНА — PAUSE FEHLGESCHLAGEN*\n\nSession   ${target || 'ungültig'}\nGrund   ${error.message}`, { quoted: msg })
        }
        break
      }

      case 'session-resume': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }

        let target = ''
        try {
          target = normalizeSessionName(args[0] || sessionId)
          await resumeKnownSession(target)
          await sendТишина(session, chatId, `Session *${target}* läuft wieder.`, { quoted: msg })
        } catch (error) {
          await sendТишина(session, chatId, `*🥀 ТИШИНА — FORTSETZEN FEHLGESCHLAGEN*\n\nSession   ${target || 'ungültig'}\nGrund   ${error.message}`, { quoted: msg })
        }
        break
      }

      case 'session-stop': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }

        let target = ''
        try {
          target = normalizeSessionName(args[0] || sessionId)
          await stopKnownSession(target)
          await sendТишина(session, chatId, `Session *${target}* wurde beendet.`, { quoted: msg })
        } catch (error) {
          await sendТишина(session, chatId, `*🥀 ТИШИНА — STOPP FEHLGESCHLAGEN*\n\nSession   ${target || 'ungültig'}\nGrund   ${error.message}`, { quoted: msg })
        }
        break
      }

      case 'session-delete': {
        commandHandled = true
        if (!canManageSessions(sender)) {
          await sendТишина(session, chatId, buildSessionManagementDeniedText(), { quoted: msg })
          break
        }

        let target = ''
        try {
          target = normalizeSessionName(args[0] || sessionId)
          await deleteKnownSession(target, sender, String(args[1] || '').toUpperCase())
          await sendТишина(session, chatId, `Session *${target}* wurde aus der Registrierung entfernt.`, { quoted: msg })
        } catch (error) {
          await sendТишина(session, chatId, `*🥀 ТИШИНА — ENTFERNEN FEHLGESCHLAGEN*\n\nSession   ${target || 'ungültig'}\nGrund   ${error.message}`, { quoted: msg })
        }
        break
      }

      default: {
        await sendТишина(session, chatId, buildUnknownCommandText(command || rawCommand), { quoted: msg })
      }
    }

    if (commandHandled) {
      user.commandCount = (user.commandCount || 0) + 1
      updateCommandStats(command)
      const { leveledUp, level } = grantXp(user, 15)
      await saveDatabase()

      if (leveledUp) {
        await sendТишина(session, chatId, `Ein neuer Schritt für ${getDisplayMention(sender)}: *Level ${level}*.\n\n🥀`, {
          quoted: msg,
          mentions: [sender]
        }).catch(() => {})
      }
    }
  } catch (error) {
    console.error('Nachrichtenverarbeitung fehlgeschlagen:', error)
  }
})

process.on('SIGINT', async () => {
  try {
    await saveDatabase()
  } finally {
    process.exit(0)
  }
})

process.on('SIGTERM', async () => {
  try {
    await saveDatabase()
  } finally {
    process.exit(0)
  }
})

process.on('unhandledRejection', (error) => {
  console.error('Nicht abgefangene Promise-Ablehnung:', error)
})

const isDirectRun = !!process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  await startRuntime()
}

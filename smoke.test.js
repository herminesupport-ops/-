import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { getDisplayMention, redactPhoneNumbers } from './lib/group-message.js'
import { sendТишина } from './lib/message-send.js'
import { buildTagAllMessage, collectTagAllMentions, isAuthorizedTagAll } from './lib/tagall.js'
import { buildWhatsAppCategoryMenu, buildWhatsAppMainMenu, MENU_CATEGORIES } from './lib/menu.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('Bot, website and owner configuration files pass node --check', () => {
  for (const file of ['Тишина.js', 'server.js', 'public/script.js', 'lib/group-message.js', 'lib/message-send.js', 'lib/tagall.js', 'lib/menu.js', 'scripts/ai-label-test.js', 'lib/print.js', 'lib/store.js', 'lib/simple.js', 'lib/myfunc.js', 'owner.js', 'owner.example.js']) {
    execFileSync(process.execPath, ['--check', path.join(__dirname, file)], {
      stdio: 'pipe'
    })
  }
})

test('group phone redaction preserves actual WhatsApp mentions', () => {
  const mentionedJid = '4915112345678@s.whatsapp.net'
  assert.equal(
    redactPhoneNumbers('Willkommen @4915112345678', [mentionedJid]),
    'Willkommen @4915112345678'
  )
  assert.equal(
    redactPhoneNumbers('Willkommen @4915112345678', []),
    'Willkommen @[Nummer verborgen]'
  )
  assert.equal(
    redactPhoneNumbers('Kontakt: +49 151 12345678', [mentionedJid]),
    'Kontakt: [Nummer verborgen]'
  )
})

test('group templates render real mention IDs instead of the @user placeholder', () => {
  assert.equal(getDisplayMention('4915112345678@s.whatsapp.net'), '@4915112345678')
  assert.equal(getDisplayMention('user-lid-42@lid'), '@user-lid-42')
  assert.equal(getDisplayMention({ id: '4915112345678@s.whatsapp.net', lid: 'user-lid-42@lid' }), '@4915112345678')
  assert.equal(getDisplayMention(''), 'Nutzer')
})

test('tagall sends one message with visible PN and LID tokens matched to mention metadata', async () => {
  const { mentions, skipped } = collectTagAllMentions([
    { id: '4915112345678@s.whatsapp.net', lid: '100000000000001@lid' },
    { id: '100000000000002@lid' },
    { id: '4915112345678@lid' },
    { id: '', jid: 'not-a-jid' },
    { id: '4915112345678@s.whatsapp.net' }
  ], ['100000000000003@lid'])
  assert.deepEqual(mentions, [
    '4915112345678@s.whatsapp.net',
    '100000000000002@lid',
    '4915112345678@lid',
    '100000000000003@lid'
  ])
  assert.equal(skipped, 1)

  const message = buildTagAllMessage(mentions, {
    ownerName: 'Maxichen',
    announcement: 'Test bitte lesen'
  })
  assert.ok(message)
  assert.match(message.text, /GRUPPENBENACHRICHTIGUNG/)
  assert.match(message.text, /Test bitte lesen/)
  const visibleMentionTokens = [...message.text.matchAll(/@([^\s]+)/g)].map((match) => match[1])
  assert.deepEqual(visibleMentionTokens, message.mentions.map((jid) => jid.split('@')[0]))
  assert.equal(message.mentions.length, mentions.length)
  const { generateWAMessageContent } = await import('@neelegirly/baileys/lib/Utils/messages.js')
  const serialized = await generateWAMessageContent(message, {})
  assert.equal(serialized.extendedTextMessage.text, message.text)
  assert.deepEqual(serialized.extendedTextMessage.contextInfo.mentionedJid, message.mentions)
  assert.match(buildTagAllMessage(mentions).text, /Eine kleine Nachricht an alle Mitglieder\./)

  const participants = [{ id: '4915112345678@s.whatsapp.net', lid: '100000000000009@lid', admin: 'admin' }]
  assert.equal(isAuthorizedTagAll({ participants, senderJids: ['100000000000009@lid'] }), true)
  assert.equal(isAuthorizedTagAll({ participants: [{ id: '4915112345678@lid', admin: 'admin' }], senderJids: ['4915112345678@s.whatsapp.net'] }), false)
  assert.equal(isAuthorizedTagAll({ participants, senderJids: ['4915112345000@s.whatsapp.net'] }), false)
  assert.equal(isAuthorizedTagAll({ participants: [], isOwner: true }), true)
})

test('WhatsApp main menu is single-select with restricted categories and clear navigation', async () => {
  const menu = buildWhatsAppMainMenu({
    prefix: ',',
    version: '2.0.0',
    ownerName: 'Maxichen',
    includeAdministration: false
  })
  assert.equal(menu.sections[0].rows.length, 4)
  assert.equal(menu.sections[0].rows[0].rowId, 'TISHINA_MENU_GENERAL')
  assert.equal(menu.sections[0].rows[2].title, '🥀 Gedanken')
  assert.deepEqual(menu.sections[1].rows.map((row) => row.rowId), [
    'TISHINA_COMMAND_help',
    'TISHINA_COMMAND_status',
    'TISHINA_COMMAND_website'
  ])
  assert.match(menu.text, /BOT INFORMATION/)
  assert.match(menu.text, /Prefix    ,/)

  const categoryMenu = buildWhatsAppCategoryMenu({
    categoryId: 'COMMUNITY',
    commands: [{ name: 'tagall', description: 'Mitglieder erwähnen.' }],
    prefix: ','
  })
  assert.deepEqual(categoryMenu.buttons.map((button) => button.buttonId), [
    'TISHINA_MENU_BACK',
    'TISHINA_MENU_HOME',
    'TISHINA_MENU_NEXT'
  ])
  assert.match(categoryMenu.text, /,tagall/)
  assert.equal(Object.keys(MENU_CATEGORIES).length, 5)

  const { generateWAMessageContent } = await import('@neelegirly/baileys/lib/Utils/messages.js')
  const serialized = await generateWAMessageContent(menu, {})
  assert.equal(serialized.listMessage.sections[0].rows[2].rowId, 'TISHINA_MENU_ENTERTAINMENT')
})

test('package.json uses current Maxichen WhatsApp stack', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
  assert.equal(pkg.name, 'Тишинаbasev3')
  assert.equal(pkg.main, 'Тишина.js')
  assert.equal(pkg.dependencies['@neelegirly/wa-api'], '^1.8.15')
  assert.equal(pkg.dependencies['@neelegirly/baileys'], '^2.2.31')
  assert.ok(pkg.dependencies.express)
  assert.equal(pkg.dependencies['@neelegirly/libsignal'], '^1.0.33')
  assert.equal(pkg.dependencies.qrcode, '^1.5.4')
  assert.match(pkg.scripts['pm2:start'], /ecosystem\.config\.js/)
  const ecosystem = fs.readFileSync(path.join(__dirname, 'ecosystem.config.js'), 'utf-8')
  assert.match(ecosystem, /ТишинаBaseV3/)
  assert.match(ecosystem, /ТишинаWebsite/)
})

test('README documents WhatsApp-only welcome flow and PM2 setup', () => {
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8')
  assert.match(readme, /WhatsApp-only/i)
  assert.match(readme, /!welcome/i)
  assert.match(readme, /Kick/i)
  assert.match(readme, /Banner/i)
  assert.match(readme, /Тишина-Farbwelt/i)
  assert.match(readme, /A quiet voice in a noisy world/i)
  assert.match(readme, /Website und öffentlicher Status/i)
  assert.match(readme, /http:\/\/localhost:7777/)
  assert.match(readme, /pm2:start/i)
  assert.match(readme, /session-pair/i)
  assert.match(readme, /Тишина\.js/i)
})

test('Тишина branding uses the night palette and poetic defaults', () => {
  const source = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf-8')
  const senderSource = fs.readFileSync(path.join(__dirname, 'lib', 'message-send.js'), 'utf-8')
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8')
  const owner = JSON.parse(fs.readFileSync(path.join(__dirname, 'owner.json'), 'utf-8'))
  const banner = fs.statSync(path.join(__dirname, 'docs', 'assets', 'readme-hero.jpg'))

  assert.match(source, /nightBlue: '#0D1420'/)
  assert.match(source, /QR_PRIMARY_COLOR = BRAND_COLORS\.nightBlue/)
  assert.match(source, /PREVIOUS_DEFAULT_TEMPLATES/)
  assert.match(readme, /#080B12.*#0D1420.*#151C29/)
  assert.equal(owner.regName, 'Тишина')
  assert.equal(owner.ownerTag, '🥀 By Maxichen')
  assert.ok(banner.size > 0)
})

test('AI label options reach supported text and media sends', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf-8')
  const senderSource = fs.readFileSync(path.join(__dirname, 'lib', 'message-send.js'), 'utf-8')
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8')
  const waApiSource = fs.readFileSync(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'wa-api',
    'dist',
    'Messaging',
    'index.js'
  ), 'utf-8')
  const baileysSource = fs.readFileSync(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'baileys',
    'lib',
    'Socket',
    'messages-send.js'
  ), 'utf-8')
  const waApiPackage = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'wa-api',
    'package.json'
  ), 'utf-8'))
  const baileysPackage = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'baileys',
    'package.json'
  ), 'utf-8'))

  assert.match(senderSource, /aiGenerated = false/)
  assert.match(senderSource, /ai: aiGenerated/)
  assert.match(source, /aiGenerated: true/)
  assert.equal(waApiPackage.version, '1.8.15')
  assert.equal(baileysPackage.version, '2.2.31')
  assert.match(waApiSource, /session\.sendMessage\(destJid, content, options \|\| \{\}\)/)
  assert.match(baileysSource, /AI: options\.ai/)
  assert.match(baileysSource, /if \(AI && isPrivate\)/)
  assert.match(baileysSource, /tag: 'bot',\s*attrs:\s*\{\s*biz_bot: '1'/)
  assert.match(readme, /normale statische Nachrichten.*`ai: false`/s)
  assert.match(readme, /für private PN-\/LID-Chats/)
  assert.match(readme, /muss auf einem zweiten Empfängerkonto geprüft werden/)
  assert.match(readme, /OpenAI-kompatible KI-Antwortfunktion/)
  assert.match(source, /fetch\(runtimeConfig\.ai\.endpoint/)
  assert.match(source, /controller\.abort\(\), 20_000/)
  assert.match(source, /AI_DAILY_LIMIT/)
  assert.match(source, /aiEnabledOverridden/)

  const sent = []
  const session = {
    sendMessage: async (...args) => {
      sent.push(args)
      return { key: { id: String(sent.length) } }
    }
  }
  const quoted = { key: { id: 'quoted' } }
  await sendТишина(session, '4915112345678@s.whatsapp.net', 'generated text', {
    quoted,
    aiGenerated: true
  })
  await sendТишина(session, '4915112345678@s.whatsapp.net', {
    image: Buffer.from('image'),
    caption: 'generated caption'
  }, { aiGenerated: true })
  await sendТишина(session, '4915112345678@s.whatsapp.net', 'static text')
  await sendТишина(session, '120363000000000000@g.us', {
    image: Buffer.from('image'),
    caption: 'group caption'
  }, { aiGenerated: true })

  assert.deepEqual(sent.map(([, , options]) => options.ai), [true, true, false, true])
  assert.equal(sent[0][2].quoted, quoted)
  assert.equal(sent[1][1].caption, 'generated caption')
  assert.equal(sent[3][1].caption, 'group caption')
})

test('isolated AI label harness uses its own credentials and gates the AI-flagged send', () => {
  const harness = fs.readFileSync(path.join(__dirname, 'scripts', 'ai-label-test.js'), 'utf-8')
  const baileysPackage = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    'node_modules',
    '@itsliaaa',
    'baileys',
    'package.json'
  ), 'utf-8'))
  const projectPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
  const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf-8')

  assert.equal(baileysPackage.version, '0.5.6')
  assert.equal(projectPackage.scripts['ai-label:test'], 'node scripts/ai-label-test.js')
  assert.match(harness, /runtime', 'ai-label-test-auth/)
  assert.match(harness, /ai: true \+ secureMetaServiceLabel: true/)
  assert.match(harness, /secureMetaServiceLabel: true/)
  assert.match(harness, /generateWAMessageContent/)
  assert.match(harness, /sock\.relayMessage\(recipient, content, \{/)
  assert.match(harness, /tag: 'bot'/)
  assert.match(harness, /Alle drei Varianten privat senden\? Tippe SEND:/)
  assert.match(harness, /nicht von einer KI generiert/)
  assert.doesNotMatch(harness, /AI_API_KEY|makeAiEndpoint/)
  assert.match(harness, /confirmation\.trim\(\) !== 'SEND'/)
  assert.match(harness, /linkConfirmation\.trim\(\) !== 'LINK'/)
  assert.match(gitignore, /runtime\/ai-label-test-auth\//)
})

test('QR callback renders a terminal QR and reports when WhatsApp sends no QR event', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf-8')
  const waApiSource = fs.readFileSync(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'wa-api',
    'dist',
    'Socket',
    'index.js'
  ), 'utf-8')
  assert.match(source, /const printQrToTerminal = async/)
  assert.match(source, /Тишина\.onQRUpdated\(async/)
  assert.match(source, /await printQrToTerminal\(targetSessionId, qr\)/)
  assert.match(source, /await sendQrUpdateToChat\(\{ sessionId: targetSessionId, qr \}\)/)
  assert.match(source, /const scheduleQrWaitNotice = \(sessionId = ''\) =>/)
  assert.match(source, /QR_WAIT_NOTICE_MS = 15 \* 1000/)
  assert.match(source, /wa-api-Status: \$\{status\}/)
  assert.match(source, /printQR: runtimeConfig\.printQR/)
  const qrStartSource = source.slice(
    source.indexOf('const startSessionByQr ='),
    source.indexOf('const startSessionByPairing =')
  )
  assert.doesNotMatch(qrStartSource, /startedSession/)
  assert.match(source, /WhatsApp-Socket initialisiert.*warte auf QR- oder Verbindungsereignis/)
  assert.match(waApiSource, /!hasCallbackListeners\(Defaults_1\.CALLBACK_KEY\.ON_QR\)/)

  const { default: QRCode } = await import('qrcode')
  const terminalQr = await QRCode.toString('test-session-qr', {
    type: 'terminal',
    small: true,
    errorCorrectionLevel: 'M'
  })
  assert.match(terminalQr, /[\u2580-\u259f]/)

  const requireFromBaileys = createRequire(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'baileys',
    'lib',
    'Utils',
    'generics.js'
  ))
  assert.equal(typeof requireFromBaileys('qrcode-terminal').generate, 'function')
})

test('Owner system has seven local roles and protects admin commands', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf-8')
  const menuSource = fs.readFileSync(path.join(__dirname, 'lib', 'menu.js'), 'utf-8')
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8')
  const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf-8')
  const legacyOwnerConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'owner.json'), 'utf-8'))
  const { BOT_OWNER_INFO, OWNERS } = await import('./owner.js')
  const ownerListBuilder = source.match(/const buildOwnerListText = \(\) => \[[\s\S]*?\n\]\.join\('\\n'\)/)?.[0] || ''

  assert.equal(OWNERS.length, 7)
  assert.equal(BOT_OWNER_INFO.ownerCount, 7)
  assert.equal(OWNERS[0].name, 'Maxichen')
  assert.equal(OWNERS[0].role, 'Hauptinhaber')
  assert.equal(OWNERS[0].level, 100)
  assert.ok(OWNERS.slice(1).every((owner) => owner.enabled && owner.level === 90))
  assert.ok(OWNERS.every((owner) => /^\d{10,15}$/.test(owner.number)))
  assert.equal(new Set(OWNERS.map((owner) => owner.number)).size, 7)
  assert.match(gitignore, /^owner\.js$/m)
  assert.equal(Object.hasOwn(legacyOwnerConfig, 'ownerNumber'), false)
  assert.match(source, /getOwnerBySender/)
  assert.match(source, /normalizedText\.startsWith\(','\)/)
  assert.match(source, /case 'maintenance'/)
  assert.match(source, /case 'restart'/)
  assert.match(source, /case 'ownerlist'/)
  assert.match(source, /case 'botinfo'/)
  assert.match(source, /case 'botstatus'/)
  assert.match(source, /case 'ai'/)
  assert.match(source, /buildWhatsAppMainMenu/)
  assert.match(menuSource, /TISHINA_MENU_\$\{id\}/)
  assert.match(source, /case 'tagall'/)
  assert.match(source, /announcement: args\.join\(' '\)/)
  assert.match(source, /isAuthorizedTagAll/)
  assert.match(source, /publishPublicStatus/)
  assert.match(source, /sanitizeGroupPayload/)
  assert.doesNotMatch(ownerListBuilder, /owner\.number/)
  assert.match(readme, /owner\.js.*lokal/i)
})

test('Session migration is collision-safe and keeps credential backups private and ignored', () => {
  const source = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf8')
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8')
  const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8')

  assert.match(source, /const getCredentialTreeSnapshot =/)
  assert.doesNotMatch(source, /getCredentialTreeStats/)
  assert.match(source, /hasLegacyPrimary && hasCanonicalPrimary/)
  assert.match(source, /JSON\.stringify\(sourceSnapshot\) !== JSON\.stringify\(targetSnapshot\)/)
  assert.match(source, /runtime', 'session-backups', 'credentials'/)
  assert.match(source, /runtime', 'session-backups', 'registries'/)
  assert.match(source, /fs\.chmodSync\(backupDirectory, 0o700\)/)
  assert.match(source, /SESSION_ALREADY_REGISTERED/)
  assert.match(source, /const reconcilePersistedSessionStates = \(\) =>/)
  assert.match(source, /if \(reconcilePersistedSessionStates\(\)\) \{\s+await db\.write\(\)/)
  assert.match(gitignore, /^runtime\/session-backups\/$/m)
  assert.match(readme, /Original wird anschließend in das von Git ignorierte `runtime\/session-backups\/credentials\/` verschoben/)
})

test('Website publishes only public bot metadata and lists implemented commands', () => {
  const publicDir = path.join(__dirname, 'public')
  const commands = JSON.parse(fs.readFileSync(path.join(publicDir, 'commands.json'), 'utf8'))
  const source = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8')
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else files.push(entryPath)
    }
  }
  visit(publicDir)

  assert.deepEqual(commands.map((group) => group.category), ['Allgemein', 'Informationen', 'Gedanken', 'Community', 'Administration'])
  const availableCommands = commands.flatMap((group) => group.commands).filter((command) => command.available !== false)
  assert.equal(availableCommands.some((command) => command.name === 'groupinfo'), true)
  assert.equal(availableCommands.some((command) => command.name === 'addmeta' && command.permission === 'Owner oder Gruppen-Admin'), true)
  assert.equal(availableCommands.some((command) => command.name === 'kickmeta' && command.permission === 'Owner oder Gruppen-Admin'), true)
  assert.equal(availableCommands.some((command) => command.name === 'tagall' && command.permission === 'Owner oder Gruppen-Admin'), true)
  assert.equal(availableCommands.some((command) => command.name === 'restart' && command.protected), true)
  const botSource = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf8')
  for (const command of availableCommands) assert.match(botSource, new RegExp(`case '${command.name}'`))
  assert.match(source, /\/api\/status/)
  assert.match(source, /\/api\/bot/)
  assert.match(source, /\/api\/version/)
  assert.match(source, /heartbeatExpiryMs/)
  assert.match(source, /process\.env\.PORT \|\| '7777'/)
  assert.match(source, /process\.env\.HOST \|\| 'localhost'/)
  assert.match(source, /dotenv\.config/)
  assert.match(botSource, /META_AI_JID = '867051314767696@bot'/)
  assert.match(botSource, /fetchFreshGroupMetadata/)
  assert.match(botSource, /groupParticipantsUpdate\(chatId, \[META_AI_JID\], action\)/)
  assert.match(botSource, /if \(!isOwner\(sender\) && !senderIsAdmin\)/)
  assert.match(botSource, /if \(!botIsAdmin\)/)
  assert.match(fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8'), /fetch\('\/api\/commands'/)
  assert.match(fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8'), /demo-category/)
  assert.match(fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8'), /ArrowLeft/)
  assert.match(fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8'), /pointerup/)
  assert.match(fs.readFileSync(path.join(publicDir, 'style.css'), 'utf8'), /\.demo-category\[aria-selected="true"\]/)
  assert.match(fs.readFileSync(path.join(publicDir, 'style.css'), 'utf8'), /@media \(max-width: 640px\)/)
  assert.match(fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8'), /^runtime\/status\.json$/m)
  assert.match(fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8'), /^HOST=localhost$/m)
  assert.match(fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8'), /^PORT=7777$/m)
  assert.match(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'), /script\.js\?v=5/)
  const menuScript = fs.readFileSync(path.join(publicDir, 'script.js'), 'utf8')
  assert.match(menuScript, /data-command=/)
  assert.match(menuScript, /navigator\.clipboard\.writeText/)
  assert.match(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'), /demo-shortcuts/)
  assert.match(fs.readFileSync(path.join(__dirname, 'ecosystem.config.js'), 'utf8'), /PORT: '7777'/)
  assert.match(fs.readFileSync(path.join(__dirname, 'ecosystem.config.js'), 'utf8'), /HOST: '0\.0\.0\.0'/)

  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\b\d{10,15}\b/, `${path.relative(publicDir, file)} must not contain a phone number`)
  }
})

test('Pinned Baileys version encodes selectable WhatsApp menu lists', async () => {
  const menu = buildWhatsAppMainMenu({
    prefix: '!',
    version: '2.0.0',
    includeAdministration: true
  })
  const { generateWAMessageContent } = await import('@neelegirly/baileys/lib/Utils/messages.js')
  const message = await generateWAMessageContent(menu, {})

  assert.equal(message.listMessage.sections[0].rows[0].rowId, 'TISHINA_MENU_GENERAL')
  assert.equal(message.listMessage.sections[0].rows.length, 5)
  assert.deepEqual(message.listMessage.sections[1].rows.map((row) => row.rowId), [
    'TISHINA_COMMAND_help',
    'TISHINA_COMMAND_status',
    'TISHINA_COMMAND_website'
  ])
})

test('Baileys retry manager resolves a compatible named LRUCache export', () => {
  const requireFromBaileys = createRequire(path.join(
    __dirname,
    'node_modules',
    '@neelegirly',
    'baileys',
    'lib',
    'Utils',
    'message-retry-manager.js'
  ))
  const { LRUCache } = requireFromBaileys('lru-cache')
  const { MessageRetryManager } = requireFromBaileys('./message-retry-manager.js')
  const manager = new MessageRetryManager({ debug() {}, info() {}, warn() {}, error() {} }, 5)

  assert.equal(typeof LRUCache, 'function')
  assert.equal(typeof manager.recentMessagesMap.set, 'function')
  assert.equal(typeof manager.sessionRecreateHistory.set, 'function')
  assert.equal(typeof manager.retryCounters.set, 'function')
})

test('Website serves pages and safe status endpoints', async () => {
  const portReservation = net.createServer()
  await new Promise((resolve, reject) => {
    portReservation.once('error', reject)
    portReservation.listen(0, 'localhost', resolve)
  })
  const port = portReservation.address().port
  await new Promise((resolve, reject) => portReservation.close((error) => error ? reject(error) : resolve()))

  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, HOST: '0.0.0.0', PORT: String(port) },
    stdio: 'ignore'
  })
  const origin = `http://127.0.0.1:${port}`
  try {
    let response
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Website-Prozess endete mit Code ${child.exitCode}.`)
      try {
        response = await fetch(`${origin}/health`)
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    assert.equal(response?.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })

    const [home, commandsPage, statusResponse, botResponse, versionResponse, scriptResponse] = await Promise.all([
      fetch(origin),
      fetch(`${origin}/commands`),
      fetch(`${origin}/api/status`),
      fetch(`${origin}/api/bot`),
      fetch(`${origin}/api/version`),
      fetch(`${origin}/script.js`)
    ])
    assert.match(await home.text(), /Т И Ш И Н А/)
    assert.match(await commandsPage.text(), /commands-list/)
    assert.match(await scriptResponse.text(), /data-command=/)
    assert.match(scriptResponse.headers.get('cache-control') || '', /no-cache/)
    const status = await statusResponse.json()
    assert.ok(['online', 'connecting', 'maintenance', 'offline'].includes(status.whatsapp))
    assert.equal(status.webserver, 'online')
    assert.equal(Object.hasOwn(status, 'sessions'), false)
    assert.deepEqual(Object.keys(await botResponse.json()).sort(), ['developer', 'name', 'prefix', 'version'])
    assert.equal((await versionResponse.json()).version, JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version)
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => {
      if (child.exitCode !== null) resolve()
      else {
        child.once('exit', resolve)
        setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL')
        }, 2000).unref()
      }
    })
  }
})

test('event config and sendТишина naming are documented in files', () => {
  const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf-8')
  const source = fs.readFileSync(path.join(__dirname, 'Тишина.js'), 'utf-8')
  const ecosystem = fs.readFileSync(path.join(__dirname, 'ecosystem.config.js'), 'utf-8')

  for (const key of [
    'DISCORD_TOKEN=',
    'CLIENT_ID=',
    'GUILD_ID=',
    'WELCOME_CHANNEL_ID=',
    'LEAVE_CHANNEL_ID=',
    'KICK_LOG_CHANNEL_ID=',
    'WELCOME_BANNER_URL=',
    'LEAVE_BANNER_URL=',
    'KICK_BANNER_URL='
  ]) {
    assert.match(envExample, new RegExp(key))
  }

  assert.match(source, /import \{ buildMessageSendOptions, sanitizeGroupPayload, sendТишина \} from '\.\/lib\/message-send\.js'/)
  assert.doesNotMatch(source, /sendTextMessage/)
  assert.match(source, /import QRCode from 'qrcode'/)
  assert.match(source, /Тишина\.onQRUpdated\(async/)
  assert.match(source, /createBrandQrBuffer/)
  assert.match(ecosystem, /ТишинаBaseV3/)
  assert.match(ecosystem, /\.\/logs\/ТишинаBaseV3/)
})

import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import makeWASocket, { generateWAMessageContent, useMultiFileAuthState } from '@itsliaaa/baileys'
import QRCode from 'qrcode'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const authDir = resolve(rootDir, 'runtime', 'ai-label-test-auth')
const testMessage = 'Manuell erstellter KI-Label-Protokolltest; nicht von einer KI generiert.'
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

const normalizePrivateJid = (input) => {
  const value = input.trim()
  if (/^\+?[\d\s()-]+$/.test(value)) {
    const digits = value.replace(/\D/g, '')
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      throw new Error('Bitte gib eine internationale Nummer mit 8 bis 15 Ziffern ein.')
    }
    return `${digits}@s.whatsapp.net`
  }

  if (/^[1-9]\d{7,14}@s\.whatsapp\.net$/.test(value) || /^[A-Za-z0-9._-]+@lid$/.test(value)) {
    return value
  }

  throw new Error('Erlaubt sind eine internationale private Nummer oder eine private PN-/LID-Adresse.')
}

const main = async () => {
  const rl = createInterface({ input: stdin, output: stdout })
  let sock

  try {
    console.log('🥀 Isolierter KI-Label-Protokolltest mit @itsliaaa/baileys')
    console.log('Verwende ausschließlich ein separates WhatsApp-Senderkonto, nicht das Konto des laufenden Bots.')
    console.log('Dieser Testtext wurde manuell erstellt und ist keine KI-generierte Antwort.')
    console.log(`Test-Zugangsdaten: ${authDir}`)

    const linkConfirmation = await rl.question('Wenn du ein separates Testkonto verwendest, tippe LINK: ')
    if (linkConfirmation.trim() !== 'LINK') {
      console.log('Abgebrochen; es wurde keine WhatsApp-Verbindung gestartet.')
      return
    }

    await mkdir(authDir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    sock = makeWASocket({ auth: state })

    sock.ev.on('creds.update', () => {
      saveCreds().catch((error) => {
        console.error('Test-Zugangsdaten konnten nicht gespeichert werden:', error.message)
      })
    })

    const connectionReady = new Promise((resolveReady, rejectReady) => {
      let settled = false
      sock.ev.on('connection.update', ({ connection, qr }) => {
        if (qr) {
          QRCode.toString(qr, { type: 'terminal', small: true })
            .then((terminalQr) => {
              console.log('Scanne diesen QR-Code mit dem separaten Test-Senderkonto:\n')
              console.log(terminalQr)
            })
            .catch(rejectReady)
        }

        if (connection === 'open' && !settled) {
          settled = true
          resolveReady()
        } else if (connection === 'close' && !settled) {
          settled = true
          rejectReady(new Error('Die WhatsApp-Testverbindung wurde vorzeitig geschlossen.'))
        }
      })
    })

    console.log('Warte auf QR-Code und Verbindung …')
    await connectionReady
    console.log('Testkonto verbunden.')

    const recipient = normalizePrivateJid(await rl.question('Private Empfänger-Nummer oder PN-/LID-Adresse: '))
    const senderJid = String(sock.user?.id || '').replace(/:\d+@/, '@')
    if (recipient === senderJid) {
      throw new Error('Der Empfänger darf nicht das verbundene Senderkonto sein.')
    }

    const variants = [
      {
        name: '1/3 Standard: ai: true',
        send: () => sock.sendMessage(recipient, {
          text: `${testMessage} Variante 1/3: ai: true.`,
          ai: true
        })
      },
      {
        name: '2/3 ai: true + secureMetaServiceLabel: true',
        send: () => sock.sendMessage(recipient, {
          text: `${testMessage} Variante 2/3: ai: true + secureMetaServiceLabel.`,
          ai: true,
          secureMetaServiceLabel: true
        })
      },
      {
        name: '3/3 ai: true + manueller bot-Node über relayMessage',
        send: async () => {
          const content = await generateWAMessageContent({
            text: `${testMessage} Variante 3/3: manueller bot-Node.`
          }, {})
          return sock.relayMessage(recipient, content, {
            additionalNodes: [{
              tag: 'bot',
              attrs: { biz_bot: '1' }
            }]
          })
        }
      }
    ]

    console.log('\nEs werden bis zu drei klar markierte Testnachrichten gesendet:')
    for (const variant of variants) console.log(`- ${variant.name}`)
    console.log(`Empfänger: ${recipient}`)
    console.log('Alle Texte sind manuell erstellt und keine KI-generierten Antworten.')
    const confirmation = await rl.question('\nAlle drei Varianten privat senden? Tippe SEND: ')
    if (confirmation.trim() !== 'SEND') {
      console.log('Abgebrochen; es wurde keine Nachricht gesendet.')
      return
    }

    for (const [index, variant] of variants.entries()) {
      try {
        const sent = await variant.send()
        if (!sent) {
          console.error(`${variant.name}: Socket hat den Versand nicht bestätigt.`)
        } else {
          console.log(`${variant.name}: Versand an ${recipient} bestätigt.`)
        }
      } catch (error) {
        console.error(`${variant.name}: Versand fehlgeschlagen: ${error.message}`)
      }

      if (index < variants.length - 1) await delay(1500)
    }

    console.log('Prüfe auf dem Empfängerkonto die drei markierten Nachrichten und vergleiche die Label-Anzeige.')
  } finally {
    rl.close()
    if (sock) {
      try {
        await sock.end(undefined)
      } catch (error) {
        console.error('Die Testverbindung konnte nicht sauber beendet werden:', error.message)
      }
    }
  }
}

main().catch((error) => {
  console.error('KI-Label-Protokolltest fehlgeschlagen:', error.message)
  process.exitCode = 1
})

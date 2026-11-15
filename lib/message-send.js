import { redactPhoneNumbers } from './group-message.js'

export const buildMessageSendOptions = ({ quoted = null, aiGenerated = false } = {}) => ({
  ...(quoted ? { quoted } : {}),
  ai: aiGenerated
})

export const sanitizeGroupPayload = (chatId, payload) => {
  if (!String(chatId || '').endsWith('@g.us')) return payload
  const safePayload = { ...payload }
  for (const field of ['text', 'caption']) {
    if (typeof safePayload[field] === 'string') {
      safePayload[field] = redactPhoneNumbers(safePayload[field], safePayload.mentions)
    }
  }
  return safePayload
}

export const sendТишина = async (
  session,
  chatId,
  content,
  { quoted = null, mentions = [], aiGenerated = false } = {}
) => {
  if (typeof content !== 'string' && (!content || typeof content !== 'object' || Array.isArray(content))) {
    throw new TypeError('Nachrichteninhalt muss Text oder ein WhatsApp-Nachrichtenobjekt sein.')
  }

  const payload = typeof content === 'string' ? { text: content } : { ...content }
  if (mentions.length) payload.mentions = mentions
  return session.sendMessage(
    chatId,
    sanitizeGroupPayload(chatId, payload),
    buildMessageSendOptions({ quoted, aiGenerated })
  )
}

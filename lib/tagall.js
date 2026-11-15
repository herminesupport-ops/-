const SUPPORTED_MENTION_SERVERS = new Set(['s.whatsapp.net', 'c.us', 'lid'])

const normalizeJid = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  const separator = raw.lastIndexOf('@')
  if (separator <= 0) return ''

  const user = raw.slice(0, separator).split(':')[0]
  const server = raw.slice(separator + 1)
  return user && SUPPORTED_MENTION_SERVERS.has(server) ? `${user}@${server}` : ''
}

const isSameMentionUser = (left, right) => {
  const [leftUser, leftServer] = left.split('@')
  const [rightUser, rightServer] = right.split('@')
  if (leftUser === rightUser && leftServer === rightServer) return true
  const phoneServers = new Set(['s.whatsapp.net', 'c.us'])
  const leftDigits = leftUser.replace(/\D/g, '')
  const rightDigits = rightUser.replace(/\D/g, '')
  return phoneServers.has(leftServer)
    && phoneServers.has(rightServer)
    && leftDigits !== ''
    && leftDigits === rightDigits
}

const participantCandidates = (participant = {}) => {
  if (typeof participant === 'string') return [participant]
  return [
    participant?.id,
    participant?.jid,
    participant?.phoneNumber,
    participant?.lid,
    participant?.participant
  ].filter((value) => typeof value === 'string')
}

export const collectTagAllMentions = (participants = [], botJids = []) => {
  const mentions = []
  let skipped = 0

  for (const participant of Array.isArray(participants) ? participants : []) {
    const jid = participantCandidates(participant).map(normalizeJid).find(Boolean)
    if (!jid) {
      skipped += 1
      continue
    }
    if (!mentions.some((existing) => isSameMentionUser(existing, jid))) mentions.push(jid)
  }

  for (const botJid of botJids) {
    const jid = normalizeJid(botJid)
    if (jid && !mentions.some((existing) => isSameMentionUser(existing, jid))) mentions.push(jid)
  }

  return { mentions, skipped }
}

export const buildTagAllMessage = (mentions, {
  ownerName = 'Maxichen',
  announcement = ''
} = {}) => {
  const validMentions = []
  for (const value of Array.isArray(mentions) ? mentions : []) {
    const jid = normalizeJid(value)
    if (jid && !validMentions.some((existing) => isSameMentionUser(existing, jid))) validMentions.push(jid)
  }
  if (!validMentions.length) return null

  const announcementText = String(announcement || '').trim() || 'Eine kleine Nachricht an alle Mitglieder.'
  const mentionText = validMentions.map((jid) => `@${jid.split('@')[0]}`).join(' ')
  return {
    text: [
      '*🥀 ТИШИНА — GRUPPENBENACHRICHTIGUNG*',
      '',
      announcementText,
      '',
      mentionText,
      '',
      '_«Иногда тишина говорит больше, чем тысяча слов.»_',
      '',
      '— Тишина 🥀',
      `By ${ownerName}`
    ].join('\n'),
    mentions: validMentions
  }
}

export const isAuthorizedTagAll = ({
  participants = [],
  senderJids = [],
  isOwner = false
} = {}) => {
  if (isOwner) return true
  const senderIds = senderJids.map(normalizeJid).filter(Boolean)
  return participants.some((participant) => {
    if (!['admin', 'superadmin'].includes(participant?.admin)) return false
    return participantCandidates(participant)
      .map(normalizeJid)
      .filter(Boolean)
      .some((participantJid) => senderIds.some((senderJid) => isSameMentionUser(participantJid, senderJid)))
  })
}

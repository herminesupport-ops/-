const PHONE_NUMBER_PATTERN = /(?<!\d)\+?\d(?:[\s().-]*\d){9,14}(?!\d)/g

const extractDigits = (value = '') => String(value ?? '').replace(/\D/g, '')

export const getDisplayMention = (participant = '') => {
  const candidates = typeof participant === 'string'
    ? [participant]
    : [participant?.id, participant?.jid, participant?.phoneNumber, participant?.lid, participant?.participant]
      .filter((value) => typeof value === 'string')
  const jid = candidates.find((value) => value.includes('@')) || candidates[0] || ''
  const user = String(jid).trim().split('@')[0].split(':')[0]
  return user ? `@${user}` : 'Nutzer'
}

export const redactPhoneNumbers = (text = '', mentions = []) => {
  const mentionedNumbers = new Set(
    (Array.isArray(mentions) ? mentions : [mentions])
      .map((jid) => extractDigits(String(jid || '').split('@')[0]))
      .filter(Boolean)
  )

  return String(text).replace(PHONE_NUMBER_PATTERN, (number, offset, source) => {
    const digits = extractDigits(number)
    return source[offset - 1] === '@' && mentionedNumbers.has(digits)
      ? number
      : '[Nummer verborgen]'
  })
}

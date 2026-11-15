export const MENU_CATEGORIES = Object.freeze({
  GENERAL: Object.freeze({
    label: '🌙 Allgemein',
    commandCategory: 'Allgemein',
    description: 'Hilfe, Commands und alltägliche Funktionen.'
  }),
  INFORMATION: Object.freeze({
    label: '🕯 Informationen',
    commandCategory: 'Informationen',
    description: 'Bot-Informationen, Status, Version und Laufzeit.'
  }),
  ENTERTAINMENT: Object.freeze({
    label: '🥀 Gedanken',
    commandCategory: 'Gedanken',
    description: 'Poetische Gedanken und besondere Inhalte.'
  }),
  COMMUNITY: Object.freeze({
    label: '❄ Community',
    commandCategory: 'Community',
    description: 'Gruppeninformationen, Begrüßungen und Community-Funktionen.'
  }),
  ADMINISTRATION: Object.freeze({
    label: '🔒 Administration',
    commandCategory: 'Administration',
    description: 'Geschützte Verwaltungsfunktionen für autorisierte Owner.'
  })
})

export const getMenuCategoryIds = ({ includeAdministration = true } = {}) => {
  const ids = Object.keys(MENU_CATEGORIES)
  return includeAdministration ? ids : ids.filter((id) => id !== 'ADMINISTRATION')
}

export const buildWhatsAppMainMenu = ({
  prefix = '!',
  version = '',
  ownerName = 'Maxichen',
  includeAdministration = true
} = {}) => {
  const categoryIds = getMenuCategoryIds({ includeAdministration })
  return {
    title: '🥀 Т И Ш И Н А',
    text: [
      '*«Иногда тишина говорит больше, чем тысяча слов.»*',
      '',
      'Willkommen in einer ruhigeren Welt.',
      '',
      '╭─ BOT INFORMATION ─╮',
      '│ Name      Тишина',
      `│ Version   ${version}`,
      `│ Prefix    ${prefix}`,
      `│ Owner     ${ownerName}`,
      '│ Status    Online',
      '╰────────────────────╯',
      '',
      'Wähle eine Kategorie.'
    ].join('\n'),
    buttonText: 'Kategorie wählen',
    footer: '— Тишина 🥀 · By Maxichen',
    sections: [{
      title: 'KATEGORIEN · EINZELAUSWAHL',
      rows: categoryIds.map((id) => ({
        title: MENU_CATEGORIES[id].label,
        rowId: `TISHINA_MENU_${id}`,
        description: MENU_CATEGORIES[id].description
      }))
    }, {
      title: 'SCHNELLZUGRIFF',
      rows: [
        { title: '🕯 Hilfe', rowId: 'TISHINA_COMMAND_help', description: 'Befehle und kurze Orientierung.' },
        { title: '❄ Status', rowId: 'TISHINA_COMMAND_status', description: 'Verbindung und Bot-Status.' },
        { title: '🌐 Website', rowId: 'TISHINA_COMMAND_website', description: 'Тишина im Browser besuchen.' }
      ]
    }]
  }
}

export const buildWhatsAppCategoryMenu = ({
  categoryId,
  commands = [],
  prefix = '!',
  ownerName = 'Maxichen',
  page = 0,
  total = Object.keys(MENU_CATEGORIES).length
} = {}) => {
  const category = MENU_CATEGORIES[categoryId]
  if (!category) throw new RangeError(`Unbekannte Menü-Kategorie: ${categoryId}`)

  const rows = commands.map((entry) => `\`${prefix}${entry.name}\` · ${entry.description}`)
  const navigation = [
    { buttonId: 'TISHINA_MENU_BACK', buttonText: { displayText: '‹ Kategorien' }, type: 1 },
    { buttonId: 'TISHINA_MENU_HOME', buttonText: { displayText: '⌂ Hauptmenü' }, type: 1 },
    { buttonId: 'TISHINA_MENU_NEXT', buttonText: { displayText: 'Weiter ›' }, type: 1 }
  ]

  return {
    text: [
      '🥀 Т И Ш И Н А',
      '',
      `*${category.label}*`,
      category.description,
      '',
      ...(rows.length ? rows : ['Für diese Kategorie sind keine Befehle freigegeben.']),
      '',
      `SEITE   ${String(page + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
      '',
      '— Тишина 🥀',
      `By ${ownerName}`
    ].join('\n'),
    footer: 'Eine Auswahl · Ruhig durch Тишина',
    buttons: navigation,
    headerType: 1
  }
}

export const getNextMenuCategoryId = (categoryId, { includeAdministration = true } = {}) => {
  const ids = getMenuCategoryIds({ includeAdministration })
  const index = ids.indexOf(categoryId)
  if (index < 0) return ids[0] || null
  return ids[(index + 1) % ids.length]
}

const menuCategoryStyle = {
  Allgemein: { icon: '🌙', description: 'Hilfe, Commands und alltägliche Funktionen.' },
  Informationen: { icon: '🕯', description: 'Bot-Informationen, Status, Version und Laufzeit.' },
  Gedanken: { icon: '🥀', description: 'Poetische Gedanken und besondere Inhalte.' },
  Community: { icon: '❄', description: 'Gruppeninformationen und Community-Funktionen.' },
  Administration: { icon: '🔒', description: 'Geschützte Funktionen für autorisierte Owner.' }
}

const $ = (selector, root = document) => root.querySelector(selector)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const setupNavigation = () => {
  const toggle = $('.nav-toggle')
  const nav = $('#primary-nav')
  if (!toggle || !nav) return
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!expanded))
    nav.classList.toggle('is-open', !expanded)
  })
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open')
      toggle.setAttribute('aria-expanded', 'false')
    }
  })
}

const setupMenuDemo = async () => {
  const demo = $('#menu-demo')
  const content = $('#demo-content')
  const page = $('#demo-page')
  const tabs = $('#demo-tabs')
  const feedback = $('#demo-feedback')
  if (!demo || !content || !page || !tabs || !feedback) return
  let menuCategories
  let commandPrefix
  try {
    const [commandsResponse, botResponse] = await Promise.all([
      fetch('/api/commands', { headers: { Accept: 'application/json' } }),
      fetch('/api/bot', { headers: { Accept: 'application/json' } })
    ])
    if (!commandsResponse.ok || !botResponse.ok) throw new Error('Menüdaten konnten nicht geladen werden.')
    const [groups, bot] = await Promise.all([commandsResponse.json(), botResponse.json()])
    commandPrefix = typeof bot.prefix === 'string' && bot.prefix ? bot.prefix : '!'
    menuCategories = groups.map((group) => ({
      title: group.category,
      icon: menuCategoryStyle[group.category]?.icon || '✧',
      description: menuCategoryStyle[group.category]?.description || 'Funktionen von Тишина.',
      commands: group.commands.filter((entry) => entry.available !== false)
    }))
  } catch {
    content.textContent = 'Das Menü ist gerade nicht erreichbar. Bitte lade die Seite erneut.'
    tabs.textContent = 'Menüdaten nicht verfügbar'
    feedback.textContent = 'Die Kategorien konnten nicht geladen werden.'
    return
  }

  let selected = 0
  let renderToken = 0
  tabs.innerHTML = menuCategories.map((entry, index) =>
    `<button class="demo-category" type="button" role="tab" aria-selected="${index === selected}" aria-label="${escapeHtml(entry.title)}"><span class="demo-category-icon" aria-hidden="true">${entry.icon}</span><span class="demo-category-copy"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.description)}</small></span><span class="demo-category-arrow" aria-hidden="true">↗</span></button>`
  ).join('')

  const select = (index) => {
    selected = (index + menuCategories.length) % menuCategories.length
    tabs.querySelectorAll('button').forEach((button, cardIndex) => {
      button.setAttribute('aria-selected', String(cardIndex === selected))
    })
    render(true)
  }

  tabs.querySelectorAll('button').forEach((button, index) => {
    button.addEventListener('click', () => select(index))
  })

  const render = (animate = false) => {
    const token = ++renderToken
    const category = menuCategories[selected]
    if (animate) content.classList.add('is-changing')
    window.setTimeout(() => {
      if (token !== renderToken) return
      content.innerHTML = `<div class="demo-category-detail"><p class="demo-detail-eyebrow">${category.icon} AUSGEWÄHLTE KATEGORIE</p><h3>${escapeHtml(category.title)}</h3><p class="demo-detail-description">${escapeHtml(category.description)}</p><div class="demo-command-list">${category.commands.map(({ name, description }) =>
        `<button class="demo-command" type="button" data-command="${escapeHtml(name)}" aria-label="${escapeHtml(`${commandPrefix}${name} kopieren`)}"><strong>${escapeHtml(`${commandPrefix}${name}`)}</strong><span>${escapeHtml(description)}</span><i aria-hidden="true">↗</i></button>`
      ).join('')}</div></div>`
      page.textContent = `${selected + 1} / ${menuCategories.length}`
      content.classList.remove('is-changing')
    }, animate ? 130 : 0)
  }
  content.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-command]')
    if (!button) return
    const command = `${commandPrefix}${button.dataset.command}`
    try {
      await navigator.clipboard.writeText(command)
      feedback.textContent = `${command} kopiert.`
    } catch {
      feedback.textContent = `Kopieren nicht möglich. Befehl: ${command}`
    }
  })
  $('#demo-prev')?.addEventListener('click', () => select(selected - 1))
  $('#demo-next')?.addEventListener('click', () => select(selected + 1))
  demo.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); select(selected - 1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); select(selected + 1) }
  })
  let touchStartX = null
  demo.addEventListener('pointerdown', (event) => { touchStartX = event.clientX })
  demo.addEventListener('pointerup', (event) => {
    if (touchStartX === null) return
    const delta = event.clientX - touchStartX
    if (Math.abs(delta) > 55) select(selected + (delta < 0 ? 1 : -1))
    touchStartX = null
  })
  render()
}

const renderCommandGroups = async (target, preview = false) => {
  if (!target) return
  try {
    const response = await fetch('/api/commands', { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Commandliste nicht verfügbar.')
    const groups = await response.json()
    const filtered = preview ? groups.filter((group) => group.category !== 'Administration' && group.category !== 'Gedanken') : groups
    target.innerHTML = filtered.map((group) => {
      const entries = group.commands.filter((command) => preview ? command.available !== false : true)
      const content = entries.map((command) => preview
        ? `<p>,${escapeHtml(command.name)}</p>`
        : `<article class="command-row"><h3><span>,${escapeHtml(command.name)}</span><span class="badge ${command.protected ? 'badge-owner' : ''}">${command.protected ? '🔒 ' : ''}${escapeHtml(command.permission)}</span></h3><p>${escapeHtml(command.description)}</p>${command.available === false ? '<span class="badge badge-unavailable">Noch nicht verfügbar</span>' : ''}</article>`
      ).join('')
      return `<section class="${preview ? 'command-category' : ''}"><h3>${escapeHtml(group.category)}</h3>${preview ? content : `<div class="commands-page-grid">${content}</div>`}</section>`
    }).join('')
  } catch {
    target.textContent = 'Die Command-Übersicht ist momentan nicht verfügbar.'
  }
}

const statusClass = (value) => {
  const normalized = String(value).toLowerCase()
  if (normalized === 'online') return 'state-online'
  if (normalized === 'offline' || normalized === 'maintenance') return 'state-offline'
  return ''
}

const setupStatus = async () => {
  const container = $('#status-list')
  if (!container) return
  try {
    const response = await fetch('/api/status', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!response.ok) throw new Error('Status nicht verfügbar.')
    const data = await response.json()
    const rows = [
      ['WhatsApp', data.whatsapp],
      ['Webserver', data.webserver],
      ['Bot-Version', data.version],
      ['KI-System', data.aiEnabled ? 'Aktiviert' : 'Deaktiviert'],
      ['Wartung', data.maintenance ? 'Aktiv' : 'Inaktiv']
    ]
    container.innerHTML = rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd class="${statusClass(value)}">${escapeHtml(value)}</dd></div>`).join('')
    const updated = $('#status-updated')
    if (updated) updated.textContent = `Aktualisiert ${new Date(data.updatedAt).toLocaleTimeString('de-DE')}`
    const note = $('#status-note')
    if (note) note.textContent = data.whatsapp === 'offline' ? 'Der Bot-Heartbeat ist nicht aktuell. WhatsApp wird als offline angezeigt.' : 'Status basiert auf dem zuletzt empfangenen Bot-Heartbeat.'
  } catch {
    container.innerHTML = '<div><dt>WhatsApp</dt><dd class="state-offline">Unbekannt</dd></div><div><dt>Webserver</dt><dd class="state-online">Online</dd></div><div><dt>Bot-Version</dt><dd>–</dd></div><div><dt>KI-System</dt><dd>Unbekannt</dd></div><div><dt>Wartung</dt><dd>Unbekannt</dd></div>'
    const updated = $('#status-updated')
    if (updated) updated.textContent = 'Status derzeit nicht verfügbar'
  }
}

setupNavigation()
setupMenuDemo()
renderCommandGroups($('#command-preview'), true)
renderCommandGroups($('#commands-list'))
setupStatus()
window.setInterval(setupStatus, 15000)

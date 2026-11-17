// ZiCode (OpenCode) Chrome Extension — Background Service Worker v2.5.0
// Multi-Frame (allFrames: true) Deep Reader for Webmail (Kerio Connect, Gmail, Yandex, Outlook), Messengers, 1C/ERP & Interactive Reply/Compose Agent Bridge

const DEFAULT_SERVERS = [
  "http://127.0.0.1:4096",
  "http://localhost:4096",
]

let lastSyncPayload = {
  updatedAt: 0,
  tabs: [],
}
let isSyncing = false
let isRunningActions = false

async function getConfig() {
  try {
    const stored = await chrome.storage.local.get(["serverUrl", "autoSync", "lastSyncPayload"])
    if (stored.lastSyncPayload && Array.isArray(stored.lastSyncPayload.tabs) && lastSyncPayload.tabs.length === 0) {
      lastSyncPayload = stored.lastSyncPayload
    }
    return {
      serverUrl: stored.serverUrl || "http://127.0.0.1:4096",
      autoSync: stored.autoSync !== false,
    }
  } catch {
    return { serverUrl: "http://127.0.0.1:4096", autoSync: true }
  }
}

// Injected into EVERY frame (allFrames: true) of each open tab to capture iframes (Kerio Connect, 1C, Webmail), Shadow DOM, email lists, opened emails, and tables
function frameDeepExtractor() {
  try {
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim()

    // 1. Collect text from current document + any accessible same-origin child iframes + shadow roots
    const collectAllDocs = (rootDoc, depth = 0) => {
      const docs = [{ doc: rootDoc, label: depth === 0 ? "main" : `iframe-${depth}` }]
      if (depth > 3) return docs
      try {
        const iframes = Array.from(rootDoc.querySelectorAll("iframe, frame"))
        for (const fr of iframes) {
          try {
            const subDoc = fr.contentDocument || fr.contentWindow?.document
            if (subDoc && subDoc.body) {
              docs.push(...collectAllDocs(subDoc, depth + 1))
            }
          } catch {}
        }
      } catch {}
      return docs
    }

    const docs = collectAllDocs(document)
    const emailRows = []
    const openedEmails = []
    const tablesData = []
    const controls = []
    const headings = []
    const rawChunks = []
    let selection = ""

    const isAdminConsole =
      /administration|администрирован/i.test(document.title || "") ||
      /\/admin\b/i.test(window.location.href || "")

    try {
      selection = window.getSelection ? norm(window.getSelection().toString()) : ""
    } catch {}

    const seenRows = new Set()
    const timeLineRx =
      /^(\d{1,2}:\d{2}|\d{1,2}\s+(?:янв|фев|мар|апр|мая|май|июн|июл|авг|сен|окт|ноя|дек|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[а-яa-z.]*|\d{2}\.\d{2}\.\d{2,4}|вчера|сегодня|yesterday|today)$/i
    const navNoiseRx =
      /^(kerio connect|поиск|входящие|отправленные|черновики|спам|корзина|папки|new email|\+\s*new email|oldest|newest|1[-–]\d+\s+из\s+\d+|\d+)$/i

    for (const { doc } of docs) {
      try {
        // Headings
        for (const h of Array.from(doc.querySelectorAll("h1, h2, h3, [role='heading']")).slice(0, 30)) {
          const t = norm(h.textContent)
          if (t && t.length > 1) headings.push(t)
        }

        // Strategy 1: Structured line-stream parser for Modern Kerio Connect Client (v9.3+/v10+) & Webmail message cards
        if (!isAdminConsole && doc.body) {
          const rawBodyLines = (doc.body.innerText || "")
            .split(/\r?\n/)
            .map((l) => norm(l))
            .filter(Boolean)

          const timeIndices = []
          for (let i = 1; i < rawBodyLines.length; i++) {
            if (timeLineRx.test(rawBodyLines[i])) {
              timeIndices.push(i)
            }
          }

          for (let k = 0; k < timeIndices.length; k++) {
            const tIdx = timeIndices[k]
            const timeStr = rawBodyLines[tIdx]
            let sender = rawBodyLines[tIdx - 1] || ""
            if (/^[A-ZА-ЯЁ0-9]{1,3}$/i.test(sender) && tIdx >= 2 && !navNoiseRx.test(rawBodyLines[tIdx - 2])) {
              sender = rawBodyLines[tIdx - 2]
            }
            if (!sender || navNoiseRx.test(sender)) continue

            let nextCardStart = rawBodyLines.length
            if (k + 1 < timeIndices.length) {
              const nextT = timeIndices[k + 1]
              nextCardStart =
                nextT >= 2 && /^[A-ZА-ЯЁ0-9]{1,3}$/i.test(rawBodyLines[nextT - 2]) ? nextT - 2 : nextT - 1
            } else {
              nextCardStart = Math.min(rawBodyLines.length, tIdx + 4)
            }

            const afterLines = rawBodyLines
              .slice(tIdx + 1, nextCardStart)
              .filter((l) => !navNoiseRx.test(l) && !/^[A-ZА-ЯЁ0-9]{1,2}$/i.test(l))

            const subject = afterLines[0] || "(без темы)"
            const snippet = afterLines.slice(1, 4).join(" ")
            const formatted = `Отправитель: ${sender} | Время: ${timeStr} | Тема: ${subject}${
              snippet ? ` | Краткое содержание: ${snippet}` : ""
            }`
            if (!seenRows.has(formatted)) {
              seenRows.add(formatted)
              emailRows.push(formatted)
            }
            if (emailRows.length >= 50) break
          }
        }

        // Strategy 2: Detect Email / Message List Rows (Kerio Connect ExtJS grids .x-grid3-row / .x-grid-row / .x-grid-item, Gmail/Yandex/Outlook/Roundcube rows)
        const rowSelectors = [
          ".x-grid3-row",
          ".x-grid-row",
          ".x-grid-item",
          ".k-grid-row",
          ".mail-MessageSnippet",
          ".letter-list-item",
          ".msg-list-item",
          ".messageRow",
          ".message-list-item",
          "[class*='mail-item']",
          "[class*='message-item']",
          "tr.zA",
          "[role='row']",
          "[role='listitem']",
          "[data-testid*='message-item']",
          ".im-mess-stack",
        ].join(", ")

        const candidateRows = Array.from(doc.querySelectorAll(rowSelectors))
        for (const row of candidateRows) {
          const text = norm(row.innerText || row.textContent)
          if (!text || text.length < 6 || text.length > 600) continue
          if (seenRows.has(text)) continue
          seenRows.add(text)

          if (isAdminConsole) {
            tablesData.push(`[Учётная запись Kerio Admin]: ${text}`)
            continue
          }

          const isSelected =
            row.classList?.contains("x-grid3-row-selected") ||
            row.classList?.contains("x-grid-row-selected") ||
            row.classList?.contains("x-grid-item-selected") ||
            row.getAttribute("aria-selected") === "true"

          const isUnread =
            row.classList?.contains("unread") ||
            row.classList?.contains("x-grid3-row-unread") ||
            /font-weight:\s*(bold|700|600)/i.test(row.getAttribute("style") || "") ||
            Boolean(row.querySelector("b, strong, .unread"))

          emailRows.push(
            `${isSelected ? "[ВЫБРАНО] " : ""}${isUnread ? "[НОВОЕ] " : ""}${text}`,
          )
          if (emailRows.length >= 50) break
        }

        // Detect Opened Email Header & Body (Kerio Connect reading pane, Webmail message view, iframe message body)
        const mailBodySelectors = [
          ".mail-body",
          ".message-body",
          "#message-body",
          ".letter-body",
          ".msg-body",
          ".x-panel-body",
          "[role='main']",
          "article",
        ]
        for (const sel of mailBodySelectors) {
          for (const el of Array.from(doc.querySelectorAll(sel)).slice(0, 8)) {
            const t = (el.innerText || el.textContent || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim()
            if (t.length > 80 && t.length < 30000) {
              openedEmails.push(t.slice(0, 8000))
            }
          }
        }

        // Extract Tables & Data Grids (1C, BelVEB, AutoParts, Dashboards, Kerio)
        for (const tbl of Array.from(doc.querySelectorAll("table")).slice(0, 12)) {
          const rows = Array.from(tbl.querySelectorAll("tr"))
            .slice(0, 35)
            .map((tr) =>
              Array.from(tr.querySelectorAll("th, td"))
                .map((cell) => norm(cell.innerText || cell.textContent))
                .filter(Boolean)
                .join(" | "),
            )
            .filter((r) => r.length > 3)
          if (rows.length > 0) {
            tablesData.push(rows.join("\n"))
          }
        }

        // Extract Interactive Buttons & Inputs (Ответить, Написать, Отправить, Кому, Тема, Поиск)
        const btnEls = Array.from(
          doc.querySelectorAll(
            "button, [role='button'], a.x-btn, .x-btn-text, input[type='button'], input[type='submit'], input[type='text'], input[type='email'], textarea, [contenteditable='true']",
          ),
        )
        for (const el of btnEls.slice(0, 80)) {
          const tag = (el.tagName || "").toLowerCase()
          const label = norm(
            el.innerText ||
              el.textContent ||
              el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              el.getAttribute("placeholder") ||
              el.getAttribute("name") ||
              el.getAttribute("value") ||
              "",
          )
          if (tag === "textarea" || el.getAttribute("contenteditable") === "true") {
            controls.push(`[ПОЛЕ ВВОДА ТЕКСТА / ПИСЬМА]: ${label || "Редактор текста сообщения"}`)
          } else if (tag === "input") {
            if (label) controls.push(`[ПОЛЕ ${el.getAttribute("type") || "text"}]: ${label}`)
          } else if (
            label &&
            /(ответ|reply|написа|созда|нов|compose|отправ|send|пересл|forward|поиск|search|входящ|inbox)/i.test(label)
          ) {
            controls.push(`[КНОПКА]: "${label}"`)
          }
        }

        // Full body text of this document/frame (including editable email body iframes)
        const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim() : ""
        if (bodyText) {
          rawChunks.push(bodyText.slice(0, 20000))
        }

        // Also walk top-level Shadow Roots if present
        const allEls = Array.from(doc.querySelectorAll("*")).slice(0, 500)
        for (const el of allEls) {
          if (el.shadowRoot) {
            const st = (el.shadowRoot.innerText || el.shadowRoot.textContent || "").trim()
            if (st && st.length > 20) rawChunks.push(st.slice(0, 8000))
          }
        }
      } catch {}
    }

    return {
      frameUrl: window.location.href,
      frameTitle: document.title || "",
      selection,
      headings: Array.from(new Set(headings)).slice(0, 25),
      emailRows: Array.from(new Set(emailRows)).slice(0, 40),
      openedEmails: Array.from(new Set(openedEmails)).slice(0, 6),
      tablesData: Array.from(new Set(tablesData)).slice(0, 6),
      controls: Array.from(new Set(controls)).slice(0, 30),
      rawText: rawChunks.join("\n\n").slice(0, 25000),
    }
  } catch (e) {
    return {
      frameUrl: window.location.href,
      frameTitle: document.title || "",
      selection: "",
      headings: [],
      emailRows: [],
      openedEmails: [],
      tablesData: [],
      controls: [],
      rawText: "",
    }
  }
}

async function extractTabSnapshot(tab) {
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension|devtools|view-source):/i.test(tab.url)) {
    return { content: "", headings: [], selection: "", metaDescription: "" }
  }

  try {
    const results = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: frameDeepExtractor,
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 900)),
    ])

    if (Array.isArray(results) && results.length > 0) {
      const allHeadings = []
      const allEmailRows = []
      const allOpenedEmails = []
      const allTables = []
      const allControls = []
      const allRawTexts = []
      let activeSelection = ""

      for (const frameRes of results) {
        const r = frameRes?.result
        if (!r) continue
        if (r.selection && !activeSelection) activeSelection = r.selection
        if (Array.isArray(r.headings)) allHeadings.push(...r.headings)
        if (Array.isArray(r.emailRows)) allEmailRows.push(...r.emailRows)
        if (Array.isArray(r.openedEmails)) allOpenedEmails.push(...r.openedEmails)
        if (Array.isArray(r.tablesData)) allTables.push(...r.tablesData)
        if (Array.isArray(r.controls)) allControls.push(...r.controls)
        if (r.rawText && r.rawText.trim()) {
          allRawTexts.push(r.rawText.trim())
        }
      }

      const uniqEmails = Array.from(new Set(allEmailRows))
      const uniqOpened = Array.from(new Set(allOpenedEmails))
      const uniqTables = Array.from(new Set(allTables))
      const uniqControls = Array.from(new Set(allControls))
      const uniqRaw = Array.from(new Set(allRawTexts))

      const sections = []
      if (uniqEmails.length > 0) {
        sections.push(
          `=== СПИСОК ПИСЕМ / СТРОК СООБЩЕНИЙ ВО ВКЛАДКЕ (${uniqEmails.length} шт.) ===\n` +
            uniqEmails.map((row, idx) => `${idx + 1}. ${row}`).join("\n"),
        )
      }
      if (uniqOpened.length > 0) {
        sections.push(
          `=== ОТКРЫТОЕ ПИСЬМО / ПАНЕЛЬ ЧТЕНИЯ ===\n` + uniqOpened.join("\n---\n").slice(0, 12000),
        )
      }
      if (uniqControls.length > 0) {
        sections.push(`=== КНОПКИ И ПОЛЯ УПРАВЛЕНИЯ ===\n` + uniqControls.join(" | "))
      }
      if (uniqTables.length > 0) {
        sections.push(`=== ТАБЛИЧНЫЕ ДАННЫЕ ===\n` + uniqTables.join("\n---\n").slice(0, 10000))
      }
      if (uniqRaw.length > 0) {
        sections.push(`=== ПОЛНЫЙ ТЕКСТ ВСЕХ ФРЕЙМОВ СТРАНИЦЫ ===\n` + uniqRaw.join("\n\n---\n\n").slice(0, 22000))
      }

      const combinedContent = sections.join("\n\n").slice(0, 42000)
      return {
        content: combinedContent,
        headings: Array.from(new Set(allHeadings)).slice(0, 30),
        selection: activeSelection,
        metaDescription: uniqEmails.length > 0 ? `Писем/строк: ${uniqEmails.length}` : "",
      }
    }
  } catch {}
  return { content: "", headings: [], selection: "", metaDescription: "" }
}

// Interactive DOM Action Executor (runs inside all frames of target tab to click emails, read N emails, or reply/compose & send messages!)
function runDomActionInFrame(actionPayload) {
  try {
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim()
    const lower = (s) => norm(s).toLowerCase()

    const collectDocs = (rootDoc, depth = 0) => {
      const list = [rootDoc]
      if (depth > 3) return list
      try {
        for (const fr of Array.from(rootDoc.querySelectorAll("iframe, frame"))) {
          try {
            const sub = fr.contentDocument || fr.contentWindow?.document
            if (sub && sub.body) list.push(...collectDocs(sub, depth + 1))
          } catch {}
        }
      } catch {}
      return list
    }

    const docs = collectDocs(document)

    const fireClick = (el) => {
      if (!el) return false
      try {
        el.scrollIntoView?.({ block: "center", inline: "center" })
      } catch {}
      const opts = { bubbles: true, cancelable: true, view: window }
      el.dispatchEvent(new MouseEvent("mousedown", opts))
      el.dispatchEvent(new MouseEvent("mouseup", opts))
      el.click?.()
      el.dispatchEvent(new MouseEvent("dblclick", opts))
      return true
    }

    const setFieldValue = (el, text, appendOrPrepend = "prepend") => {
      if (!el) return false
      try {
        el.focus?.()
        const tag = (el.tagName || "").toLowerCase()
        if (tag === "input" || tag === "textarea") {
          const nextVal =
            appendOrPrepend === "replace" || !el.value
              ? text
              : `${text}\n\n${el.value}`
          const proto = tag === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
          if (setter) setter.call(el, nextVal)
          else el.value = nextVal
          el.dispatchEvent(new Event("input", { bubbles: true }))
          el.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
        // Rich text / contenteditable or iframe body (Kerio Connect, Gmail, Yandex, Roundcube, TinyMCE)
        const htmlText = String(text)
          .split("\n")
          .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`)
          .join("")
        if (appendOrPrepend === "replace" || !norm(el.innerText)) {
          el.innerHTML = htmlText
        } else {
          el.innerHTML = `${htmlText}<br>${el.innerHTML}`
        }
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }))
        return true
      } catch {
        return false
      }
    }

    const findRowByQuery = (q) => {
      const needle = lower(q)
      if (!needle) return null
      const rowSelectors =
        ".x-grid3-row, .x-grid-row, .x-grid-item, .k-grid-row, .mail-MessageSnippet, .letter-list-item, .msg-list-item, .messageRow, [class*='mail-item'], [class*='message-item'], tr.zA, [role='row'], [role='listitem'], tr"
      for (const doc of docs) {
        const rows = Array.from(doc.querySelectorAll(rowSelectors))
        for (const r of rows) {
          const t = lower(r.innerText || r.textContent)
          if (t && t.includes(needle) && t.length < 900) {
            return r
          }
        }
      }
      // Fallback for Modern Kerio Connect Client div/li cards
      for (const doc of docs) {
        const cards = Array.from(doc.querySelectorAll("div, li, article, a"))
        let bestCard = null
        let bestLen = 999999
        for (const c of cards) {
          const t = lower(c.innerText || c.textContent)
          if (t && t.includes(needle) && t.length >= 12 && t.length <= 450 && t.length < bestLen) {
            bestCard = c
            bestLen = t.length
          }
        }
        if (bestCard) return bestCard
      }
      return null
    }

    const findButtonByPattern = (regex) => {
      const btnSelectors =
        "button, [role='button'], a.x-btn, .x-btn, .x-btn-text, .x-menu-item, span.x-btn-inner, input[type='button'], input[type='submit'], a, div[tabindex], span"
      for (const doc of docs) {
        const els = Array.from(doc.querySelectorAll(btnSelectors))
        for (const el of els) {
          const label = norm(
            el.innerText ||
              el.textContent ||
              el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              el.getAttribute("data-tooltip") ||
              el.getAttribute("value") ||
              "",
          )
          if (label && label.length <= 45 && regex.test(label)) {
            return { el, label }
          }
        }
      }
      return null
    }

    const type = actionPayload.actionType || "open_email"
    const logs = []

    // ACTION 1: Click / open an email row or page element by sender/subject/text
    if (type === "open_email" || type === "click") {
      const query = actionPayload.senderQuery || actionPayload.targetText || ""
      const row = findRowByQuery(query)
      if (row) {
        fireClick(row)
        logs.push(`Открыта строка/письмо по запросу "${query}": ${norm(row.innerText).slice(0, 180)}`)
        return { matched: true, logs }
      }
      // Try any clickable element containing query
      const btn = findButtonByPattern(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
      if (btn) {
        fireClick(btn.el)
        logs.push(`Нажат элемент "${btn.label}"`)
        return { matched: true, logs }
      }
      return { matched: false, logs }
    }

    // ACTION 2: Select email row (optional) and click Reply or Compose
    if (type === "reply_step1_open_composer") {
      if (actionPayload.senderQuery) {
        const row = findRowByQuery(actionPayload.senderQuery)
        if (row) {
          fireClick(row)
          logs.push(`Выбрано письмо от/с темой "${actionPayload.senderQuery}"`)
        }
      }
      const isCompose = actionPayload.mode === "compose"
      const btnRegex = isCompose
        ? /^(\+?\s*new email|написать|создать|новое письмо|compose|new mail|new message|написать письмо)$/i
        : /^(ответить|reply|ответить всем|reply all)$/i
      const fallbackRegex = isCompose
        ? /(new email|написать|создать письмо|новое письмо|compose|new mail)/i
        : /(ответить|reply)/i

      const found = findButtonByPattern(btnRegex) || findButtonByPattern(fallbackRegex)
      if (found) {
        fireClick(found.el)
        logs.push(`Нажата кнопка "${found.label}"`)
        return { matched: true, clickedButton: found.label, logs }
      }
      return { matched: false, logs }
    }

    // ACTION 3: Fill recipient, subject, and message body in the open composer (including Kerio Connect composer iframe!) and optionally click Send
    if (type === "reply_step2_fill_and_send") {
      let filledBody = false
      let filledRecipient = false
      let filledSubject = false
      let clickedSend = false

      for (const doc of docs) {
        // Fill recipient (Кому / To) if provided
        if (actionPayload.recipient && !filledRecipient) {
          const inputs = Array.from(doc.querySelectorAll("input[type='text'], input[type='email'], input:not([type]), textarea"))
          for (const inp of inputs) {
            const hint = lower(
              inp.getAttribute("placeholder") ||
                inp.getAttribute("aria-label") ||
                inp.getAttribute("name") ||
                inp.getAttribute("id") ||
                "",
            )
            if (/(кому|^to$|recipient|адрес|получател)/i.test(hint)) {
              filledRecipient = setFieldValue(inp, actionPayload.recipient, "replace")
              if (filledRecipient) {
                logs.push(`Заполнено поле «Кому»: ${actionPayload.recipient}`)
                break
              }
            }
          }
        }

        // Fill subject (Тема / Subject) if provided
        if (actionPayload.subject && !filledSubject) {
          const inputs = Array.from(doc.querySelectorAll("input[type='text'], input:not([type])"))
          for (const inp of inputs) {
            const hint = lower(
              inp.getAttribute("placeholder") ||
                inp.getAttribute("aria-label") ||
                inp.getAttribute("name") ||
                inp.getAttribute("id") ||
                "",
            )
            if (/(тема|subject|subj)/i.test(hint)) {
              filledSubject = setFieldValue(inp, actionPayload.subject, "replace")
              if (filledSubject) {
                logs.push(`Заполнено поле «Тема»: ${actionPayload.subject}`)
                break
              }
            }
          }
        }

        // Fill message body (Kerio Connect editable iframe body, contenteditable div, or textarea)
        if (actionPayload.messageBody && !filledBody) {
          // 1. Check if this doc itself is an editable composer iframe (designMode="on" or body.isContentEditable)
          if (
            doc !== document &&
            doc.body &&
            (doc.designMode === "on" ||
              doc.body.isContentEditable ||
              doc.body.getAttribute("contenteditable") === "true" ||
              doc.body.classList?.contains("editable"))
          ) {
            filledBody = setFieldValue(doc.body, actionPayload.messageBody, "prepend")
            if (filledBody) {
              logs.push(`Текст сообщения введён в iframe-редактор письма (${actionPayload.messageBody.length} симв.)`)
            }
          }

          // 2. Check [contenteditable="true"] elements and <textarea> in doc
          if (!filledBody) {
            const editors = Array.from(
              doc.querySelectorAll(
                "[contenteditable='true'], [role='textbox'], textarea, .Am.Al.editable, .mail-Compose-Editor",
              ),
            )
            for (const ed of editors) {
              const rect = ed.getBoundingClientRect?.()
              if (rect && rect.width > 120 && rect.height > 24) {
                filledBody = setFieldValue(ed, actionPayload.messageBody, "prepend")
                if (filledBody) {
                  logs.push(`Текст ответа введён в поле сообщения (${actionPayload.messageBody.length} симв.)`)
                  break
                }
              }
            }
          }
        }
      }

      // Optionally click Send («Отправить» / «Send») if autoSend === true
      if (actionPayload.autoSend && filledBody) {
        const sendBtn =
          findButtonByPattern(/^(отправить|send|отправить сообщение|отправить письмо)$/i) ||
          findButtonByPattern(/(отправить|send)/i)
        if (sendBtn) {
          fireClick(sendBtn.el)
          clickedSend = true
          logs.push(`Нажата кнопка отправки «${sendBtn.label}»!`)
        }
      }

      return {
        matched: filledBody || filledRecipient || filledSubject,
        filledBody,
        filledRecipient,
        filledSubject,
        clickedSend,
        logs,
      }
    }

    return { matched: false, logs }
  } catch (err) {
    return { matched: false, error: String(err?.message || err), logs: [] }
  }
}

async function findTargetTab(action) {
  const allTabs = await chrome.tabs.query({})
  if (action.tabId) {
    const byId = allTabs.find((t) => t.id === Number(action.tabId))
    if (byId) return byId
  }
  if (action.query) {
    const q = String(action.query).toLowerCase()
    const byQuery = allTabs.find(
      (t) => (t.title || "").toLowerCase().includes(q) || (t.url || "").toLowerCase().includes(q),
    )
    if (byQuery) return byQuery
  }
  // Prefer mail / messenger tabs (Kerio, Mail, Gmail, Yandex, Outlook, Telegram, 1C) when action is email/reply related
  const mailTab = allTabs.find((t) =>
    /(kerio|mail|почт|письм|inbox|входящ|roundcube|zimbra|outlook|gmail|yandex|telegram|whatsapp|1c|1с)/i.test(
      `${t.title || ""} ${t.url || ""}`,
    ),
  )
  if (mailTab) return mailTab
  return allTabs.find((t) => t.active) || allTabs[0] || null
}

async function executeBrowserAction(action, serverBaseUrl) {
  try {
    const targetTab = await findTargetTab(action)
    if (!targetTab || !targetTab.id) {
      await fetch(`${serverBaseUrl}/api/browser/action-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: action.actionId,
          ok: false,
          message: "Не найдена подходящая открытая вкладка в Chrome.",
        }),
      })
      return
    }

    const allLogs = []
    const type = action.actionType || "open_email"

    if (type === "open_email" || type === "click") {
      // If user wants to click/open a specific email row or read multiple rows
      const queries = Array.isArray(action.queries) && action.queries.length > 0
        ? action.queries
        : [action.senderQuery || action.targetText || ""].filter(Boolean)

      for (const q of queries) {
        const res = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id, allFrames: true },
          func: runDomActionInFrame,
          args: [{ ...action, actionType: "open_email", senderQuery: q, targetText: q }],
        })
        for (const r of res || []) {
          if (Array.isArray(r?.result?.logs)) allLogs.push(...r.result.logs)
        }
        await new Promise((r) => setTimeout(r, 850))
      }
    } else if (type === "reply_email" || type === "compose_email" || type === "send_message") {
      // Focus the mail/chat tab so the user sees the composer in action
      try {
        await chrome.tabs.update(targetTab.id, { active: true })
      } catch {}

      // Step 1: Select the sender's email (if senderQuery provided) & click Reply / Compose
      const step1Res = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id, allFrames: true },
        func: runDomActionInFrame,
        args: [
          {
            ...action,
            actionType: "reply_step1_open_composer",
            mode: type === "compose_email" ? "compose" : "reply",
          },
        ],
      })
      for (const r of step1Res || []) {
        if (Array.isArray(r?.result?.logs)) allLogs.push(...r.result.logs)
      }

      // Wait for Kerio Connect / Webmail reply editor or composer iframe to initialize
      await new Promise((r) => setTimeout(r, 1100))

      // Step 2: Fill recipient, subject, and messageBody across all frames + optionally click Send
      const step2Res = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id, allFrames: true },
        func: runDomActionInFrame,
        args: [
          {
            ...action,
            actionType: "reply_step2_fill_and_send",
          },
        ],
      })
      for (const r of step2Res || []) {
        if (Array.isArray(r?.result?.logs)) allLogs.push(...r.result.logs)
      }
      await new Promise((r) => setTimeout(r, 600))
    }

    // Re-extract full multi-frame snapshot of the target tab and sync all tabs
    const freshSnap = await extractTabSnapshot(targetTab)
    const updatedPayload = await syncOpenTabs("post_action")

    await fetch(`${serverBaseUrl}/api/browser/action-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionId: action.actionId,
        ok: true,
        tabId: targetTab.id,
        tabTitle: targetTab.title,
        tabUrl: targetTab.url,
        logs: Array.from(new Set(allLogs)),
        snapshot: freshSnap,
        tabs: updatedPayload?.tabs || [],
      }),
    })
  } catch (err) {
    try {
      await fetch(`${serverBaseUrl}/api/browser/action-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: action.actionId,
          ok: false,
          error: String(err?.message || err),
        }),
      })
    } catch {}
  }
}

async function processPendingActions(actions, serverBaseUrl) {
  if (isRunningActions || !Array.isArray(actions) || actions.length === 0) return
  isRunningActions = true
  try {
    for (const act of actions) {
      await executeBrowserAction(act, serverBaseUrl)
    }
  } finally {
    isRunningActions = false
  }
}

async function syncOpenTabs(reason = "event", opts = {}) {
  if (isSyncing) return lastSyncPayload
  isSyncing = true
  try {
    const cfg = await getConfig()
    if (!cfg.autoSync && reason !== "manual" && reason !== "post_action") {
      isSyncing = false
      return lastSyncPayload
    }

    // ВАЖНО (v2.7.2): глубокое чтение содержимого страниц (DOM/фреймы/письма)
    // выполняется ТОЛЬКО по явному запросу ZiCode (пользователь просит прочитать
    // вкладку/почту) либо по кнопке «Синхронизировать» в попапе расширения.
    // Фоновые heartbeat/alarm события отправляют только заголовки и URL вкладок,
    // поэтому расширение больше не «обшаривает» страницы браузера постоянно.
    const deep = opts.deep === true || reason === "manual" || reason === "post_action" || reason === "deep"

    const allTabs = await chrome.tabs.query({})
    const enrichedTabs = []

    // Кэш ранее извлечённого текста — чтобы не читать страницы повторно без запроса
    const previousByUrl = new Map()
    if (Array.isArray(lastSyncPayload?.tabs)) {
      for (const t of lastSyncPayload.tabs) {
        if (t?.url && t?.content) previousByUrl.set(t.url, t)
      }
    }

    const sortedTabs = [...allTabs].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0))
    let extractedCount = 0

    for (const tab of sortedTabs) {
      const url = tab.url || ""
      const isHttp = /^https?:\/\//i.test(url)
      let snap = { content: "", headings: [], selection: "", metaDescription: "" }

      if (deep && isHttp && extractedCount < 35) {
        snap = await extractTabSnapshot(tab)
        extractedCount++
      } else if (isHttp) {
        const prev = previousByUrl.get(url)
        if (prev) {
          snap = {
            content: prev.content || "",
            headings: prev.headings || [],
            selection: "",
            metaDescription: prev.metaDescription || "",
          }
        }
      }

      enrichedTabs.push({
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        title: tab.title || url || "Без названия",
        url,
        active: Boolean(tab.active),
        pinned: Boolean(tab.pinned),
        favIconUrl: tab.favIconUrl || "",
        status: tab.status || "complete",
        content: snap.content || "",
        headings: snap.headings || [],
        selection: snap.selection || "",
        metaDescription: snap.metaDescription || "",
        deep: deep,
        updatedAt: Date.now(),
      })
    }

    enrichedTabs.sort((a, b) => a.index - b.index)

    const payload = {
      source: "zicode-chrome-extension",
      version: "2.7.2",
      reason,
      deep,
      updatedAt: Date.now(),
      tabs: enrichedTabs,
    }
    lastSyncPayload = payload

    try {
      await chrome.storage.local.set({ lastSyncPayload: payload })
    } catch {}

    // 1. Push to local ZiCode Desktop (.exe) & local server on 127.0.0.1:4096 and execute any pending actions
    const targets = Array.from(new Set([cfg.serverUrl.replace(/\/+$/, ""), ...DEFAULT_SERVERS]))
    for (const baseUrl of targets) {
      try {
        const res = await fetch(`${baseUrl}/api/browser/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.pendingActions) && data.pendingActions.length > 0) {
            processPendingActions(data.pendingActions, baseUrl)
          }
        }
      } catch {}
    }

    // 2. Also broadcast to any open ZiCode Web UI tabs via chrome.tabs.sendMessage
    for (const tab of allTabs) {
      if (tab.id && tab.url && (tab.url.includes("4096") || tab.url.includes("e2b.app") || tab.url.includes("localhost"))) {
        try {
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: "ZICODE_EXTENSION_BROADCAST",
              payload,
            },
            () => {
              void chrome.runtime.lastError
            },
          )
        } catch {}
      }
    }

    return payload
  } catch {
    return lastSyncPayload
  } finally {
    isSyncing = false
  }
}

// Fast poll for interactive agent commands every 1.2s so email replies/clicks execute almost instantaneously
setInterval(async () => {
  if (isRunningActions) return
  try {
    const cfg = await getConfig()
    const baseUrl = (cfg.serverUrl || "http://127.0.0.1:4096").replace(/\/+$/, "")
    const res = await fetch(`${baseUrl}/api/browser/actions/pending`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data?.pendingActions) && data.pendingActions.length > 0) {
        await processPendingActions(data.pendingActions, baseUrl)
      }
      // ZiCode явно попросил прочитать открытые вкладки (пользователь спросил
      // про браузер/почту) — только тогда делаем глубокое извлечение текста.
      if (data?.deepSync === true && !isSyncing) {
        await syncOpenTabs("deep", { deep: true })
      }
    }
  } catch {}
}, 1200)

// Listen for tab events
chrome.tabs.onActivated.addListener(() => syncOpenTabs("tab_activated"))
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    syncOpenTabs("tab_updated")
  }
})
chrome.tabs.onRemoved.addListener(() => syncOpenTabs("tab_removed"))

// Continuous heartbeat every 4 seconds
setInterval(() => {
  syncOpenTabs("heartbeat")
}, 4000)

try {
  chrome.alarms?.create("zicode-sync-alarm", { periodInMinutes: 0.25 })
  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === "zicode-sync-alarm") {
      syncOpenTabs("alarm")
    }
  })
} catch {}

// Handle popup and content-script requests synchronously (return false so message port never hangs!)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "TRIGGER_SYNC_NOW") {
      syncOpenTabs("manual")
      sendResponse(lastSyncPayload)
      return false
    }
    if (msg?.type === "GET_LAST_SYNC") {
      sendResponse(lastSyncPayload)
      return false
    }
    if (msg?.type === "EXECUTE_PENDING_ACTIONS" && Array.isArray(msg.actions)) {
      processPendingActions(msg.actions, msg.serverUrl || "http://127.0.0.1:4096")
      sendResponse({ ok: true })
      return false
    }
    if (msg?.type === "AI_PROXY_FETCH" && msg.url) {
      fetch(msg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
          ...(msg.headers || {}),
        },
        body: msg.body,
      })
        .then(async (r) => {
          const text = await r.text()
          sendResponse({ ok: r.ok, status: r.status, text })
        })
        .catch((err) => {
          sendResponse({ ok: false, status: 0, error: String(err?.message || err) })
        })
      return true
    }
  } catch {}
  return false
})

// Initial sync on startup / install
syncOpenTabs("startup")

// ZiCode (OpenCode) Chrome Extension — Background Service Worker v2.4.1
// Continuously reads open tabs + page content and syncs them with ZiCode Desktop (.exe on 127.0.0.1:4096) and ZiCode Web UI.

const DEFAULT_SERVERS = [
  "http://127.0.0.1:4096",
  "http://localhost:4096",
]

let lastSyncPayload = {
  updatedAt: 0,
  tabs: [],
}
let isSyncing = false

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

async function extractTabSnapshot(tab) {
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension|devtools|view-source):/i.test(tab.url)) {
    return { content: "", headings: [], selection: "", metaDescription: "" }
  }

  try {
    const results = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const selection = window.getSelection ? String(window.getSelection().toString()).trim() : ""
            const metaDescription =
              document.querySelector('meta[name="description"]')?.getAttribute("content") ||
              document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
              ""
            const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
              .slice(0, 25)
              .map((el) => `${el.tagName}: ${(el.textContent || "").trim()}`)
              .filter(Boolean)
            const rawText = document.body ? document.body.innerText || document.body.textContent || "" : ""
            const content = rawText
              .replace(/\r/g, "")
              .replace(/\n{3,}/g, "\n\n")
              .trim()
              .slice(0, 18000)
            return { content, headings, selection, metaDescription }
          } catch {
            return { content: "", headings: [], selection: "", metaDescription: "" }
          }
        },
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 500)),
    ])
    if (results && results[0] && results[0].result) {
      return results[0].result
    }
  } catch {}
  return { content: "", headings: [], selection: "", metaDescription: "" }
}

async function syncOpenTabs(reason = "event") {
  if (isSyncing) return lastSyncPayload
  isSyncing = true
  try {
    const cfg = await getConfig()
    if (!cfg.autoSync && reason !== "manual") {
      isSyncing = false
      return lastSyncPayload
    }

    const allTabs = await chrome.tabs.query({})
    const enrichedTabs = []

    const sortedTabs = [...allTabs].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0))
    let extractedCount = 0

    for (const tab of sortedTabs) {
      const url = tab.url || ""
      const isHttp = /^https?:\/\//i.test(url)
      let snap = { content: "", headings: [], selection: "", metaDescription: "" }

      if (isHttp && (tab.active || extractedCount < 8)) {
        snap = await extractTabSnapshot(tab)
        extractedCount++
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
        updatedAt: Date.now(),
      })
    }

    enrichedTabs.sort((a, b) => a.index - b.index)

    const payload = {
      source: "zicode-chrome-extension",
      version: "2.4.1",
      reason,
      updatedAt: Date.now(),
      tabs: enrichedTabs,
    }
    lastSyncPayload = payload

    try {
      await chrome.storage.local.set({ lastSyncPayload: payload })
    } catch {}

    // 1. Push to local ZiCode Desktop (.exe) & local server on 127.0.0.1:4096 and localhost:4096
    const targets = Array.from(new Set([cfg.serverUrl.replace(/\/+$/, ""), ...DEFAULT_SERVERS]))
    for (const baseUrl of targets) {
      try {
        await fetch(`${baseUrl}/api/browser/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } catch {}
    }

    // 2. Also broadcast to any open ZiCode Web UI tabs via chrome.tabs.sendMessage (always consuming runtime.lastError)
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
  } catch (err) {
    return lastSyncPayload
  } finally {
    isSyncing = false
  }
}

// Listen for tab events
chrome.tabs.onActivated.addListener(() => syncOpenTabs("tab_activated"))
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    syncOpenTabs("tab_updated")
  }
})
chrome.tabs.onRemoved.addListener(() => syncOpenTabs("tab_removed"))

// Continuous heartbeat every 4 seconds while service worker is active + MV3 alarm
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
      // Trigger fresh sync in background and return current snapshot immediately so port never closes before response
      syncOpenTabs("manual")
      sendResponse(lastSyncPayload)
      return false
    }
    if (msg?.type === "GET_LAST_SYNC") {
      sendResponse(lastSyncPayload)
      return false
    }
  } catch {}
  return false
})

// Initial sync on startup / install
syncOpenTabs("startup")

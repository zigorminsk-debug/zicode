/**
 * ZiCode Chrome Bridge — Background Service Worker (Manifest V3)
 *
 * Collects open browser tabs (title, URL, active status) and extracts
 * readable text from open HTTP/HTTPS pages.
 *
 * Delivers snapshot to ZiCode via TWO channels simultaneously:
 * 1. HTTP POST to http://127.0.0.1:4096/api/browser/sync (for ZiCode Windows .exe / local server)
 * 2. Direct chrome.tabs.sendMessage to any open ZiCode web app tab (works on any URL/host)
 */

const DEFAULT_ENDPOINTS = [
  "http://127.0.0.1:4096/api/browser/sync",
  "http://localhost:4096/api/browser/sync",
]

let syncInFlight = false

function extractDomSnapshotInPage() {
  try {
    const selection = window.getSelection ? String(window.getSelection()).trim() : ""
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      ""

    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 25)

    const bodyText = (document.body?.innerText || document.documentElement?.innerText || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 24000)

    return {
      title: document.title || "",
      url: location.href,
      description: metaDesc,
      selection,
      headings,
      content: bodyText,
      extractedAt: Date.now(),
    }
  } catch (e) {
    return {
      title: document.title || "",
      url: location.href,
      content: "",
      error: String(e),
    }
  }
}

async function collectOpenTabsSnapshot() {
  const allTabs = await chrome.tabs.query({})
  const tabSummaries = []
  let activeTabDetail = null
  let extractedCount = 0

  for (const tab of allTabs) {
    const url = tab.url || ""
    const isRestricted =
      !url ||
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:")

    const item = {
      id: tab.id,
      windowId: tab.windowId,
      index: tab.index,
      title: tab.title || "Без заголовка",
      url,
      active: Boolean(tab.active),
      pinned: Boolean(tab.pinned),
      favIconUrl: tab.favIconUrl || "",
      content: "",
      headings: [],
      selection: "",
    }

    // Extract full readable text from active tabs and up to 8 open web tabs
    if (!isRestricted && tab.id && (tab.active || extractedCount < 8)) {
      extractedCount++
      try {
        const injected = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractDomSnapshotInPage,
        })
        const snap = injected?.[0]?.result
        if (snap) {
          item.content = snap.content || ""
          item.headings = snap.headings || []
          item.selection = snap.selection || ""
          item.description = snap.description || ""
          if (tab.active) {
            activeTabDetail = item
          }
        }
      } catch {
        // Ignore tabs where script injection is blocked (e.g. Chrome Web Store)
      }
    }

    tabSummaries.push(item)
  }

  return {
    timestamp: Date.now(),
    totalTabs: tabSummaries.length,
    activeTab: activeTabDetail || tabSummaries.find((t) => t.active) || tabSummaries[0] || null,
    tabs: tabSummaries,
  }
}

async function syncTabsToZiCode() {
  if (syncInFlight) return null
  syncInFlight = true
  try {
    const snapshot = await collectOpenTabsSnapshot()
    const stored = await chrome.storage.local.get(["customServerUrl"])
    const endpoints = [...DEFAULT_ENDPOINTS]
    if (stored.customServerUrl && typeof stored.customServerUrl === "string") {
      const clean = stored.customServerUrl.replace(/\/+$/, "") + "/api/browser/sync"
      if (!endpoints.includes(clean)) endpoints.unshift(clean)
    }

    let serverConnected = false
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        })
        if (res.ok) {
          serverConnected = true
          break
        }
      } catch {
        // Next endpoint
      }
    }

    // Also broadcast directly to any open ZiCode web app tab via content script
    const allTabs = await chrome.tabs.query({})
    let webInjectedCount = 0
    for (const tab of allTabs) {
      if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) continue
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "ZICODE_EXTENSION_TABS_PAYLOAD",
          payload: snapshot,
        })
        webInjectedCount++
      } catch {
        // Content script not attached on this tab
      }
    }

    const status = {
      lastSync: Date.now(),
      totalTabs: snapshot.totalTabs,
      activeTitle: snapshot.activeTab?.title || "",
      serverConnected,
      webInjectedCount,
    }
    await chrome.storage.local.set({ lastSyncStatus: status, latestSnapshot: snapshot })
    return { status, snapshot }
  } catch (err) {
    return { error: String(err) }
  } finally {
    syncInFlight = false
  }
}

// Auto-sync on tab activation, navigation completion, window focus change, or periodic heartbeat
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("zicode-sync-alarm", { periodInMinutes: 0.25 })
  syncTabsToZiCode()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("zicode-sync-alarm", { periodInMinutes: 0.25 })
  syncTabsToZiCode()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "zicode-sync-alarm") {
    syncTabsToZiCode()
  }
})

chrome.tabs.onActivated.addListener(() => {
  syncTabsToZiCode()
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.title) {
    syncTabsToZiCode()
  }
})

chrome.tabs.onRemoved.addListener(() => {
  syncTabsToZiCode()
})

chrome.windows.onFocusChanged.addListener(() => {
  syncTabsToZiCode()
})

// Continuous 3-second heartbeat while service worker is awake
setInterval(() => {
  syncTabsToZiCode()
}, 3000)

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "ZICODE_FORCE_SYNC" || msg?.type === "ZICODE_PAGE_REQUEST_SYNC") {
    syncTabsToZiCode().then((res) => sendResponse(res))
    return true
  }
})

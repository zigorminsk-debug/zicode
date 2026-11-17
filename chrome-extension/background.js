// ZiCode (OpenCode) Background Service Worker (Manifest V3)

const DEFAULT_SERVER_URL = "http://127.0.0.1:4096"

async function getSettings() {
  const data = await chrome.storage.local.get(["serverUrl", "autoSync"])
  return {
    serverUrl: (data.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, ""),
    autoSync: data.autoSync !== false,
  }
}

async function extractFromTab(tab) {
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    return {
      id: tab?.id || 0,
      title: tab?.title || "System Tab",
      url: tab?.url || "",
      active: Boolean(tab?.active),
      windowId: tab?.windowId || 0,
      content: "",
      headings: [],
      selection: "",
    }
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection ? String(window.getSelection().toString()).trim() : ""
        const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
          .slice(0, 20)
          .map((el) => `${el.tagName}: ${(el.textContent || "").trim()}`)
          .filter(Boolean)
        const rawText = document.body ? document.body.innerText || document.body.textContent || "" : ""
        return {
          title: document.title || window.location.hostname,
          url: window.location.href,
          selection,
          headings,
          content: rawText.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000),
        }
      },
    })
    const extracted = results?.[0]?.result
    if (extracted) {
      return {
        id: tab.id,
        title: extracted.title || tab.title || "",
        url: extracted.url || tab.url || "",
        active: Boolean(tab.active),
        windowId: tab.windowId || 0,
        favIconUrl: tab.favIconUrl || "",
        selection: extracted.selection || "",
        headings: extracted.headings || [],
        content: extracted.content || "",
      }
    }
  } catch {}

  return {
    id: tab.id,
    title: tab.title || "",
    url: tab.url || "",
    active: Boolean(tab.active),
    windowId: tab.windowId || 0,
    favIconUrl: tab.favIconUrl || "",
    selection: "",
    headings: [],
    content: "",
  }
}

async function collectAndSyncTabs() {
  try {
    const settings = await getSettings()
    const allTabs = await chrome.tabs.query({})
    const enrichedTabs = []

    for (const tab of allTabs) {
      // Skip ZiCode itself when choosing the "active external page", but still include in tab list
      const item = await extractFromTab(tab)
      enrichedTabs.push(item)
    }

    const activeExternal =
      enrichedTabs.find((t) => t.active && !t.title.includes("ZiCode")) ||
      enrichedTabs.find((t) => !t.title.includes("ZiCode") && t.content.length > 0) ||
      enrichedTabs.find((t) => t.active) ||
      enrichedTabs[0] ||
      null

    const payload = {
      source: "zicode-chrome-extension",
      version: "2.3.0",
      updatedAt: Date.now(),
      activeTab: activeExternal,
      tabs: enrichedTabs,
    }

    await chrome.storage.local.set({
      lastSyncAt: payload.updatedAt,
      lastTabsCount: enrichedTabs.length,
    })

    // 1. Broadcast directly into any open ZiCode Web / Studio tab in Chrome
    for (const tab of allTabs) {
      if (!tab.id || !tab.url || !/^https?:\/\//i.test(tab.url)) continue
      if (
        tab.title?.includes("ZiCode") ||
        tab.url.includes("4096") ||
        tab.url.includes("5173") ||
        tab.url.includes("e2b.app")
      ) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (syncData) => {
              window.postMessage({ type: "ZICODE_BROWSER_SYNC", payload: syncData }, "*")
            },
            args: [payload],
          })
        } catch {}
      }
    }

    // 2. Send POST to ZiCode Desktop / Local Server (http://127.0.0.1:4096/api/browser/sync)
    try {
      const res = await fetch(`${settings.serverUrl}/api/browser/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        await chrome.storage.local.set({ lastServerStatus: "connected" })
      } else {
        await chrome.storage.local.set({ lastServerStatus: `HTTP ${res.status}` })
      }
    } catch {
      await chrome.storage.local.set({ lastServerStatus: "browser-bridge-mode" })
    }

    return payload
  } catch (err) {
    return { error: String(err?.message || err), tabs: [] }
  }
}

// Auto-sync on tab switch and page load completion
chrome.tabs.onActivated.addListener(async () => {
  const { autoSync } = await getSettings()
  if (autoSync) collectAndSyncTabs()
})

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    const { autoSync } = await getSettings()
    if (autoSync) collectAndSyncTabs()
  }
})

// Periodic alarm every 30s
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("zicode-sync", { periodInMinutes: 0.5 })
  collectAndSyncTabs()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "zicode-sync") {
    const { autoSync } = await getSettings()
    if (autoSync) collectAndSyncTabs()
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "TRIGGER_SYNC_NOW") {
    collectAndSyncTabs().then((res) => sendResponse(res))
    return true
  }
  return false
})

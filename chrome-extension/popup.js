const syncBtn = document.getElementById("syncBtn")
const serverUrlInput = document.getElementById("serverUrlInput")
const autoSyncCheck = document.getElementById("autoSyncCheck")
const summaryText = document.getElementById("summaryText")
const tabsContainer = document.getElementById("tabsContainer")
const statusBadge = document.getElementById("statusBadge")

async function initPopup() {
  const stored = await chrome.storage.local.get(["serverUrl", "autoSync"])
  serverUrlInput.value = stored.serverUrl || "http://127.0.0.1:4096"
  autoSyncCheck.checked = stored.autoSync !== false
  triggerSync()
}

function renderTabs(payload) {
  const tabs = Array.isArray(payload?.tabs) ? payload.tabs : []
  summaryText.textContent = `Передано открытых вкладок: ${tabs.length}`
  statusBadge.textContent = `● ${tabs.length} вкладок`
  tabsContainer.innerHTML = ""

  for (const t of tabs) {
    const div = document.createElement("div")
    div.className = "tab-item"

    const title = document.createElement("div")
    title.className = "tab-title"
    title.textContent = `${t.active ? "★ " : ""}${t.title || t.url}`

    const meta = document.createElement("div")
    meta.className = "tab-meta"
    const hostSpan = document.createElement("span")
    try {
      hostSpan.textContent = new URL(t.url).hostname
    } catch {
      hostSpan.textContent = t.url.slice(0, 30)
    }
    const lenSpan = document.createElement("span")
    lenSpan.textContent = t.content ? `${t.content.length} симв.` : "системная"

    meta.appendChild(hostSpan)
    meta.appendChild(lenSpan)
    div.appendChild(title)
    div.appendChild(meta)
    tabsContainer.appendChild(div)
  }
}

function triggerSync() {
  syncBtn.textContent = "⏳ Синхронизация..."
  chrome.runtime.sendMessage({ type: "TRIGGER_SYNC_NOW" }, (res) => {
    syncBtn.textContent = "🔄 Синхронизировать открытые вкладки сейчас"
    if (res) renderTabs(res)
  })
}

syncBtn.addEventListener("click", triggerSync)

serverUrlInput.addEventListener("change", () => {
  chrome.storage.local.set({ serverUrl: serverUrlInput.value.trim() }, () => {
    triggerSync()
  })
})

autoSyncCheck.addEventListener("change", () => {
  chrome.storage.local.set({ autoSync: autoSyncCheck.checked })
})

initPopup()

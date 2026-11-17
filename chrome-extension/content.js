// ZiCode (OpenCode) Content Script — Page Reader & Live Bridge

function extractPageSnapshot() {
  try {
    const selection = window.getSelection ? String(window.getSelection().toString()).trim() : ""
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      ""

    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .slice(0, 25)
      .map((el) => `${el.tagName}: ${(el.textContent || "").trim()}`)
      .filter(Boolean)

    const links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 30)
      .map((a) => ({
        text: (a.textContent || "").trim().slice(0, 80),
        href: a.href,
      }))
      .filter((l) => l.text && /^https?:\/\//i.test(l.href))

    const rawText = document.body ? document.body.innerText || document.body.textContent || "" : ""
    const cleanText = rawText
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 25000)

    return {
      url: window.location.href,
      title: document.title || window.location.hostname,
      selection,
      metaDescription: metaDesc,
      headings,
      links,
      content: cleanText,
      capturedAt: Date.now(),
    }
  } catch (err) {
    return {
      url: window.location.href,
      title: document.title || "",
      content: "",
      error: String(err?.message || err),
      capturedAt: Date.now(),
    }
  }
}

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXTRACT_PAGE_SNAPSHOT") {
    sendResponse(extractPageSnapshot())
    return true
  }

  if (msg?.type === "ZICODE_EXTENSION_BROADCAST") {
    window.postMessage(
      {
        type: "ZICODE_BROWSER_SYNC",
        payload: msg.payload,
      },
      "*",
    )
    sendResponse({ ok: true })
    return true
  }
  return false
})

// Listen for requests from ZiCode Web / Studio UI
window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.type === "ZICODE_REQUEST_BROWSER_SYNC") {
    try {
      chrome.runtime.sendMessage({ type: "TRIGGER_SYNC_NOW" })
    } catch {}
  }
})

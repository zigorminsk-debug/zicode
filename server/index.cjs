const http = require("node:http")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { exec } = require("node:child_process")

const PORT = Number(process.env.PORT || 4096)
const HOST = process.env.HOST || "0.0.0.0"
const DIST_DIR = path.resolve(__dirname, "..", "dist")
const TABS_CACHE_FILE = path.join(os.tmpdir(), "zicode-browser-tabs.json")

// In-memory + disk-persisted store of open Chrome tabs pushed by the ZiCode Chrome Extension
let deepSyncRequestedAt = 0
let browserTabsStore = {
  updatedAt: 0,
  activeTab: null,
  tabs: [],
}

// Bidirectional browser command queue for reading emails, clicking rows, and replying/composing on user's behalf
const pendingBrowserActions = []
const completedBrowserActions = new Map()

function loadPersistedTabs() {
  try {
    if (fs.existsSync(TABS_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TABS_CACHE_FILE, "utf-8"))
      if (parsed && Array.isArray(parsed.tabs)) {
        browserTabsStore = parsed
      }
    }
  } catch {}
}

function savePersistedTabs(store) {
  try {
    fs.writeFileSync(TABS_CACHE_FILE, JSON.stringify(store), "utf-8")
  } catch {}
}

loadPersistedTabs()

/**
 * Parses OpenAI / OpenCode Zen SSE (`data: {...}`) streams into a standard
 * ChatCompletion JSON payload (`{ choices: [{ message: { role, content, reasoning_content, tool_calls } }], usage }`).
 */
function parseUpstreamResponse(rawText) {
  const trimmed = (rawText || "").trim()
  if (!trimmed) return { error: "Empty upstream response" }

  // 1. Try standard JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed)
    } catch {}
  }

  // 2. Parse SSE stream (data: {...}) from OpenCode Free / OpenAI / Anthropic endpoints
  if (trimmed.includes("data:")) {
    let content = ""
    let reasoningContent = ""
    const toolCallsByIndex = new Map()
    let usage = undefined
    let errorObj = null

    const lines = trimmed.split(/\r?\n/)
    for (const line of lines) {
      const clean = line.trim()
      if (!clean.startsWith("data:")) continue
      const payloadStr = clean.slice(5).trim()
      if (!payloadStr || payloadStr === "[DONE]") continue
      try {
        const evt = JSON.parse(payloadStr)
        if (evt.error) {
          errorObj = evt.error
        }
        if (evt.usage) {
          usage = evt.usage
        }
        // OpenAI / OpenCode Zen format
        const choice = evt.choices?.[0]
        if (choice) {
          if (choice.usage) usage = choice.usage
          const delta = choice.delta || choice.message
          if (delta) {
            if (typeof delta.content === "string") content += delta.content
            if (typeof delta.reasoning_content === "string") reasoningContent += delta.reasoning_content
            else if (typeof delta.reasoning === "string") reasoningContent += delta.reasoning
            else if (typeof delta.reasoning_text === "string") reasoningContent += delta.reasoning_text

            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                const existing = toolCallsByIndex.get(idx) || {
                  id: tc.id || `call_${idx}_${Date.now()}`,
                  type: "function",
                  function: { name: "", arguments: "" },
                }
                if (tc.id) existing.id = tc.id
                if (tc.function?.name) existing.function.name += tc.function.name
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
                toolCallsByIndex.set(idx, existing)
              }
            }
          }
        }
        // Anthropic SSE format
        if (evt.type === "content_block_delta" && evt.delta) {
          if (evt.delta.type === "text_delta" && typeof evt.delta.text === "string") {
            content += evt.delta.text
          } else if (evt.delta.type === "thinking_delta" && typeof evt.delta.thinking === "string") {
            reasoningContent += evt.delta.thinking
          }
        }
      } catch {}
    }

    const toolCalls = Array.from(toolCallsByIndex.values()).filter((t) => t.function.name)
    if (content || reasoningContent || toolCalls.length > 0) {
      return {
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content,
              ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
              ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
          },
        ],
        ...(usage ? { usage } : {}),
      }
    }
    if (errorObj) {
      return { error: errorObj }
    }
  }

  if (!/^<!doctype\s+html/i.test(trimmed) && !/^<html/i.test(trimmed)) {
    return {
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: trimmed,
          },
          finish_reason: "stop",
        },
      ],
    }
  }

  return { raw: rawText }
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ""
    req.on("data", (chunk) => {
      raw += chunk
      if (raw.length > 35 * 1024 * 1024) {
        reject(new Error("Payload too large"))
      }
    })
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", reject)
  })
}

function createServer(port = PORT, host = HOST) {
  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
    const pathname = urlObj.pathname

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Private-Network": "true",
      })
      return res.end()
    }

    // 1. Health & OpenCode Server info
    if (pathname === "/api/health") {
      loadPersistedTabs()
      return sendJson(res, 200, {
        status: "ok",
        engine: "ZiCode (OpenCode Core v2.7.1)",
        version: "2.7.1",
        platform: process.platform,
        arch: process.arch,
        browserTabsCount: browserTabsStore.tabs.length,
        timestamp: Date.now(),
      })
    }

    // 1a. Localhost instance replacement shutdown (allows a newly launched .exe to replace an older .exe on port 4096)
    if (pathname === "/api/shutdown" && req.method === "POST") {
      const remote = String(req.socket?.remoteAddress || "")
      if (remote.includes("127.0.0.1") || remote === "::1") {
        sendJson(res, 200, { ok: true, shuttingDown: true })
        setTimeout(() => {
          try {
            server.close()
          } catch {}
          process.exit(0)
        }, 80)
        return
      }
      return sendJson(res, 403, { ok: false })
    }

    // 1b. Chrome Extension Bridge: Receive open tabs & active page DOM content + return pending actions
    if (pathname === "/api/browser/sync" && req.method === "POST") {
      try {
        const body = await readBody(req)
        const tabs = Array.isArray(body.tabs) ? body.tabs : []
        browserTabsStore = {
          updatedAt: Date.now(),
          activeTab: body.activeTab || tabs.find((t) => t.active) || tabs[0] || null,
          tabs,
        }
        savePersistedTabs(browserTabsStore)
        const actionsToRun = pendingBrowserActions.splice(0, pendingBrowserActions.length)
        return sendJson(res, 200, {
          ok: true,
          tabsCount: tabs.length,
          updatedAt: browserTabsStore.updatedAt,
          pendingActions: actionsToRun,
        })
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message })
      }
    }

    // 1c. Chrome Extension Bridge: Read synced browser tabs
    if (pathname === "/api/browser/tabs" && req.method === "GET") {
      loadPersistedTabs()
      // ?deep=1 — приложение просит расширение один раз прочитать содержимое
      // открытых вкладок (только по явному запросу пользователя про браузер/почту)
      const wantsDeep = String(req.url || "").includes("deep=1")
      if (wantsDeep) deepSyncRequestedAt = Date.now()
      return sendJson(res, 200, { ...browserTabsStore, deepSyncRequestedAt })
    }

    // 1d. Chrome Extension Bridge: Poll pending browser actions
    if (pathname === "/api/browser/actions/pending" && req.method === "GET") {
      const actionsToRun = pendingBrowserActions.splice(0, pendingBrowserActions.length)
      // Одноразовый флаг: расширение выполнит глубокое чтение вкладок ровно один раз
      const deepSync = deepSyncRequestedAt > 0 && Date.now() - deepSyncRequestedAt < 20000
      deepSyncRequestedAt = 0
      return sendJson(res, 200, { ok: true, pendingActions: actionsToRun, deepSync })
    }

    // 1e. Chrome Extension Bridge: Report completed browser action result
    if (pathname === "/api/browser/action-result" && req.method === "POST") {
      try {
        const body = await readBody(req)
        if (body && body.actionId) {
          completedBrowserActions.set(body.actionId, body)
        }
        if (Array.isArray(body?.tabs) && body.tabs.length > 0) {
          browserTabsStore = {
            updatedAt: Date.now(),
            activeTab: body.tabs.find((t) => t.active) || body.tabs[0] || null,
            tabs: body.tabs,
          }
          savePersistedTabs(browserTabsStore)
        }
        return sendJson(res, 200, { ok: true })
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message })
      }
    }

    // 1f. Chrome Extension Bridge: Enqueue an interactive browser action (open email, reply, compose, click, read_deep) and wait for result
    if (pathname === "/api/browser/action" && req.method === "POST") {
      try {
        const body = await readBody(req)
        const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const actionObj = {
          actionId,
          createdAt: Date.now(),
          ...body,
        }
        pendingBrowserActions.push(actionObj)

        // Wait up to 9 seconds for Chrome Extension to execute the action and post result
        const startWait = Date.now()
        while (Date.now() - startWait < 9000) {
          if (completedBrowserActions.has(actionId)) {
            const result = completedBrowserActions.get(actionId)
            completedBrowserActions.delete(actionId)
            return sendJson(res, 200, {
              ok: true,
              actionId,
              result,
              tabs: browserTabsStore.tabs,
            })
          }
          await new Promise((r) => setTimeout(r, 220))
        }

        return sendJson(res, 200, {
          ok: false,
          timeout: true,
          actionId,
          message: "Действие отправлено в очередь расширения ZiCode Chrome Bridge (выполнится при следующем цикле синхронизации).",
          tabs: browserTabsStore.tabs,
        })
      } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message })
      }
    }

    // 2. Live models.opencode.ai / models.dev proxy (mirrors OpenCode ModelsDev.refresh)
    if (pathname === "/api/models-dev" && req.method === "GET") {
      const urls = [
        "https://models.opencode.ai/experimental/v2.0/api.json?type=chat,decision,image,video",
        "https://models.dev/api.json",
      ]
      for (const catalogUrl of urls) {
        try {
          const response = await fetch(catalogUrl, {
            headers: { "User-Agent": "opencode/stable/2.4.0/opencode" },
            signal: AbortSignal.timeout(8000),
          })
          if (response.ok) {
            const data = await response.json()
            return sendJson(res, 200, data)
          }
        } catch {}
      }
      return sendJson(res, 200, { offline: true })
    }

    // 3. OpenCode Free / AI Inference Proxy (supports SSE stream + JSON)
    if (pathname === "/api/ai/proxy" && req.method === "POST") {
      try {
        const reqBody = await readBody(req)
        const { url, headers = {} } = reqBody
        const payload = reqBody.payload || reqBody.body
        if (!url || typeof url !== "string") {
          return sendJson(res, 400, { error: "Missing target url" })
        }
        const upstream = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
            ...headers,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        })
        const text = await upstream.text()
        const parsed = parseUpstreamResponse(text)
        return sendJson(res, upstream.status, parsed)
      } catch (err) {
        return sendJson(res, 502, { error: err.message || "Upstream request failed" })
      }
    }

    // 4. Local Shell Execution (OpenCode bash tool backend for Windows/Linux/Android Termux)
    if (pathname === "/api/shell" && req.method === "POST") {
      try {
        const body = await readBody(req)
        const command = String(body.command || "")
        if (!command.trim()) {
          return sendJson(res, 400, { output: "Empty command" })
        }
        exec(
          command,
          {
            cwd: process.cwd(),
            timeout: Math.min(Number(body.timeout) || 25000, 60000),
            maxBuffer: 2 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            const combined = [
              `$ ${command}`,
              stdout ? stdout.trimEnd() : "",
              stderr ? `[stderr]\n${stderr.trimEnd()}` : "",
              error ? `[exit code: ${error.code ?? 1}]` : "[exit code: 0]",
            ]
              .filter(Boolean)
              .join("\n")
            return sendJson(res, 200, { output: combined })
          },
        )
        return
      } catch (err) {
        return sendJson(res, 500, { output: `Shell error: ${err.message}` })
      }
    }

    // 5. WebFetch Proxy (OpenCode webfetch tool)
    if (pathname === "/api/webfetch" && (req.method === "POST" || req.method === "GET")) {
      try {
        const body = req.method === "POST" ? await readBody(req) : {}
        const targetUrl = String(body.url || urlObj.searchParams.get("url") || "")
        const resp = await fetch(targetUrl, {
          headers: { "User-Agent": "opencode/stable/2.4.0" },
          signal: AbortSignal.timeout(12000),
        })
        const content = await resp.text()
        return sendJson(res, 200, { status: resp.status, content: content.slice(0, 50000) })
      } catch (err) {
        return sendJson(res, 200, { status: 500, content: `WebFetch error: ${err.message}` })
      }
    }

    // 6. Workspace File Export to host disk
    if (pathname === "/api/fs/write" && req.method === "POST") {
      try {
        const body = await readBody(req)
        const exportDir = path.resolve(process.cwd(), "workspace-out")
        const target = path.resolve(exportDir, String(body.path || "output.txt").replace(/^(\.\.[/\\])+/, ""))
        if (!target.startsWith(exportDir)) {
          return sendJson(res, 403, { error: "Forbidden path" })
        }
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, String(body.content ?? ""), "utf-8")
        return sendJson(res, 200, { ok: true, savedTo: target })
      } catch (err) {
        return sendJson(res, 500, { error: err.message })
      }
    }

    // Serve static files from dist/ with no-store cache control so updates apply immediately
    let filePath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname)
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403)
      return res.end("Forbidden")
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, "index.html")
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      })
      fs.createReadStream(filePath).pipe(res)
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("ZiCode build not found. Run npm run build first.")
    }
  })

  server.on("error", (err) => {
    console.error(`ZiCode server error on ${host}:${port}:`, err.message)
  })

  server.listen(port, host, () => {
    console.log(`ZiCode (OpenCode Engine) server listening on http://${host}:${port}`)
  })

  return server
}

if (require.main === module) {
  createServer()
}

module.exports = { createServer }

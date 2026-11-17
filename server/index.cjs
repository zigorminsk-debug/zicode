const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const { exec } = require("node:child_process")

const PORT = Number(process.env.PORT || 4096)
const HOST = process.env.HOST || "0.0.0.0"
const ROOT_DIR = path.resolve(__dirname, "..")
const DIST_DIR = path.join(ROOT_DIR, "dist")

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
}

// In-memory store for Chrome Extension synced browser tabs
let browserState = {
  updatedAt: 0,
  activeTab: null,
  tabs: [],
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("Payload too large"))
      }
    })
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", reject)
  })
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Private-Network": "true",
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  })
  res.end(JSON.stringify(data))
}

function createServer(port = PORT, host = HOST) {
  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
    const pathname = urlObj.pathname

    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS)
      return res.end()
    }

    if (pathname === "/api/health") {
      return sendJson(res, 200, {
        status: "ok",
        app: "ZiCode (OpenCode Engine)",
        version: "2.3.0",
        platform: process.platform,
        arch: process.arch,
        browserTabsCount: browserState.tabs.length,
      })
    }

    // Chrome Extension Sync Endpoint
    if (pathname === "/api/browser/sync" && req.method === "POST") {
      try {
        const body = await readJsonBody(req)
        browserState = {
          updatedAt: Date.now(),
          activeTab: body.activeTab || null,
          tabs: Array.isArray(body.tabs) ? body.tabs : [],
        }
        return sendJson(res, 200, {
          ok: true,
          tabsCount: browserState.tabs.length,
          updatedAt: browserState.updatedAt,
        })
      } catch (err) {
        return sendJson(res, 400, { error: err.message })
      }
    }

    if (pathname === "/api/browser/tabs" && req.method === "GET") {
      return sendJson(res, 200, browserState)
    }

    if (pathname === "/api/models-dev" && req.method === "GET") {
      try {
        const upstream = await fetch("https://models.dev/api/v2/catalog.json", {
          headers: { "User-Agent": "opencode/stable/2.3.0/opencode" },
        })
        if (upstream.ok) {
          const data = await upstream.json()
          return sendJson(res, 200, data)
        }
      } catch {}
      return sendJson(res, 200, {})
    }

    if (pathname === "/api/ai/proxy" && req.method === "POST") {
      try {
        const { url, headers, body } = await readJsonBody(req)
        const upstream = await fetch(url, {
          method: "POST",
          headers: headers || { "Content-Type": "application/json" },
          body: JSON.stringify(body || {}),
        })
        const text = await upstream.text()
        try {
          const json = JSON.parse(text)
          return sendJson(res, upstream.status, json)
        } catch {
          return sendJson(res, 200, { __proxyError: true, status: upstream.status, body: text.slice(0, 500) })
        }
      } catch (err) {
        return sendJson(res, 200, { __proxyError: true, message: err.message })
      }
    }

    if (pathname === "/api/shell" && req.method === "POST") {
      try {
        const { command } = await readJsonBody(req)
        if (!command || typeof command !== "string") {
          return sendJson(res, 400, { error: "Missing command" })
        }
        exec(
          command,
          { cwd: ROOT_DIR, timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
          (error, stdout, stderr) => {
            sendJson(res, 200, {
              stdout: stdout || "",
              stderr: stderr || "",
              exitCode: error ? error.code || 1 : 0,
            })
          },
        )
        return
      } catch (err) {
        return sendJson(res, 500, { error: err.message })
      }
    }

    if (pathname === "/api/webfetch" && req.method === "GET") {
      const targetUrl = urlObj.searchParams.get("url")
      if (!targetUrl) return sendJson(res, 400, { error: "Missing url" })
      try {
        const r = await fetch(targetUrl)
        const text = await r.text()
        return sendJson(res, 200, { url: targetUrl, content: text.slice(0, 20000) })
      } catch (err) {
        return sendJson(res, 200, { url: targetUrl, content: `Fetch error: ${err.message}` })
      }
    }

    if (pathname === "/api/fs/write" && req.method === "POST") {
      try {
        const { path: relPath, content } = await readJsonBody(req)
        return sendJson(res, 200, { ok: true, path: relPath, size: (content || "").length })
      } catch (err) {
        return sendJson(res, 500, { error: err.message })
      }
    }

    // Serve static files from dist/
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
      })
      fs.createReadStream(filePath).pipe(res)
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("ZiCode build not found. Run npm run build first.")
    }
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

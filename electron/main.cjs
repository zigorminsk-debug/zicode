const { app, BrowserWindow, shell, session } = require("electron")
const path = require("node:path")
const { createServer } = require("../server/index.cjs")

let mainWindow = null
let backendServer = null
let activePort = 4096

async function shutdownPreviousInstanceOn4096() {
  try {
    await fetch("http://127.0.0.1:4096/api/shutdown", {
      method: "POST",
      signal: AbortSignal.timeout(450),
    })
    await new Promise((r) => setTimeout(r, 250))
  } catch {}
}

async function startBackendServer() {
  await shutdownPreviousInstanceOn4096()

  return new Promise((resolve) => {
    const srv = createServer(4096, "127.0.0.1")
    srv.once("listening", () => {
      const addr = srv.address()
      activePort = typeof addr === "object" && addr?.port ? addr.port : 4096
      backendServer = srv
      resolve(activePort)
    })
    srv.once("error", () => {
      // If 4096 is still occupied by another process, bind a guaranteed free port for this .exe's UI!
      const fallbackSrv = createServer(0, "127.0.0.1")
      fallbackSrv.once("listening", () => {
        const addr = fallbackSrv.address()
        activePort = typeof addr === "object" && addr?.port ? addr.port : 4096
        backendServer = fallbackSrv
        resolve(activePort)
      })
    })
  })
}

async function createWindow(port) {
  try {
    await session.defaultSession.clearCache()
    await session.defaultSession.clearStorageData({
      storages: ["appcache", "serviceworkers", "cachestorage"],
    })
  } catch {}

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 920,
    minHeight: 620,
    title: "ZiCode v2.7 — OpenCode AI Agent + Chrome Bridge (Windows & Android)",
    backgroundColor: "#0a0c10",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}/?v=${Date.now()}`, {
    extraHeaders: "pragma: no-cache\nCache-Control: no-cache\n",
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  const port = await startBackendServer()
  await createWindow(port)

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(activePort)
  })
})

app.on("window-all-closed", () => {
  if (backendServer) {
    try {
      backendServer.close()
    } catch {}
  }
  if (process.platform !== "darwin") {
    app.quit()
  }
})

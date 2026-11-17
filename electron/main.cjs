const { app, BrowserWindow, shell, session } = require("electron")
const path = require("node:path")
const { createServer } = require("../server/index.cjs")

let mainWindow = null
let backendServer = null
const BACKEND_PORT = 4096

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

async function createWindow() {
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
    title: "ZiCode v2.4 — OpenCode AI Agent + Chrome Bridge (Windows & Android)",
    backgroundColor: "#0a0c10",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}/?v=${Date.now()}`, {
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

app.whenReady().then(() => {
  backendServer = createServer(BACKEND_PORT, "127.0.0.1")
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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

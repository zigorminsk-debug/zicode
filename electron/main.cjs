const { app, BrowserWindow, shell } = require("electron")
const path = require("node:path")
const { createServer } = require("../server/index.cjs")

let mainWindow = null
let backendServer = null
const BACKEND_PORT = 4096

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 920,
    minHeight: 620,
    title: "ZiCode — OpenCode AI Agent (Windows)",
    backgroundColor: "#0a0c10",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`)

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

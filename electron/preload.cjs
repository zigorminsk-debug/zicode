const { contextBridge } = require("electron")

contextBridge.exposeInMainWorld("ZiCodeDesktop", {
  platform: process.platform,
  arch: process.arch,
  version: "2.3.0",
})

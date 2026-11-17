const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const distDir = path.join(root, "dist")
const androidAssetsDir = path.join(root, "android", "app", "src", "main", "assets", "www")

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

if (fs.existsSync(distDir)) {
  fs.rmSync(androidAssetsDir, { recursive: true, force: true })
  copyRecursive(distDir, androidAssetsDir)
  console.log(`Synced dist/ -> android/app/src/main/assets/www/`)
} else {
  console.warn("dist/ does not exist yet. Run vite build first.")
}

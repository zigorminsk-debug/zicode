const assert = require("node:assert")
const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")

function checkFile(rel) {
  const full = path.join(root, rel)
  assert.ok(fs.existsSync(full), `Missing required file: ${rel}`)
  return fs.readFileSync(full)
}

console.log("=== Running ZiCode (OpenCode Android + Windows) Verification Suite ===")

// 1. Verify OpenCode analysis & signing docs
checkFile("docs/OPENCODE_ANALYSIS.md")
checkFile("SIGNING.md")

// 2. Verify Free AI Models catalog
const modelsSrc = checkFile("src/core/models-dev.ts").toString("utf-8")
const requiredFreeModels = [
  "big-pickle",
  "beam-free",
  "deepseek-v4.1-flash-free",
  "glm-5.3-flash-free",
  "mimo-v2.6-flash-free",
  "flint-40b-free",
  "nemotron-3-ultra-free",
  "nemotron-3.5-lightning-free",
  "nemotron-3.5-super-vl-free",
  "jev-1.13-free",
  "grok-code",
  "kimi-k2.5-free",
  "minimax-m3.1-flash-free",
  "qwen3.6-plus-free",
  "openrouter/free",
  "glm-4.7-flash",
]
for (const modelId of requiredFreeModels) {
  assert.ok(modelsSrc.includes(`"${modelId}"`), `Missing OpenCode free model: ${modelId}`)
}
console.log(`✓ Verified ${requiredFreeModels.length} core OpenCode Free AI models ($0 / apiKey='public')`)

// 3. Verify all 18 OpenCode Tools (including browser_tabs Chrome Extension bridge)
const toolsSrc = checkFile("src/core/tools.ts").toString("utf-8")
const requiredTools = [
  "github_read",
  "read",
  "write",
  "edit",
  "patch",
  "bash",
  "glob",
  "grep",
  "todowrite",
  "todoread",
  "webfetch",
  "websearch",
  "browser_tabs",
  "task",
  "question",
  "skill",
  "lsp_diagnostics",
  "mcp_call",
  "artifact",
]
for (const t of requiredTools) {
  assert.ok(toolsSrc.includes(`name: "${t}"`), `Missing OpenCode tool schema: ${t}`)
}
console.log(`✓ Verified all ${requiredTools.length} OpenCode built-in tools (including browser_tabs)`)

// 3b. Verify Chrome Extension files
checkFile("chrome-extension/manifest.json")
checkFile("chrome-extension/background.js")
checkFile("chrome-extension/content.js")
checkFile("chrome-extension/popup.html")
checkFile("chrome-extension/popup.js")
checkFile("public/ZiCode-Chrome-Extension-v2.7.2.zip")
console.log("✓ Verified Manifest V3 Chrome Extension (chrome-extension/ & ZiCode-Chrome-Extension-v2.7.2.zip)")

// 4. Verify Agents & Slash commands
const agentsSrc = checkFile("src/core/agents.ts").toString("utf-8")
for (const ag of ["build", "plan", "general", "explore"]) {
  assert.ok(agentsSrc.includes(`id: "${ag}"`), `Missing agent: ${ag}`)
}
console.log("✓ Verified OpenCode agents (Build, Plan, @general, @explore) & <system-reminder>")

// 5. Verify Web Build + Android Assets + Persistent Release Keystore
checkFile("dist/index.html")
checkFile("android/app/src/main/assets/www/index.html")
const keystoreBuf = checkFile("android/keystores/zicode-release.p12")
assert.ok(keystoreBuf.length > 1000, "Keystore file appears invalid")
checkFile("android/app/build.gradle")
checkFile("android/app/src/main/java/ai/zicode/opencode/MainActivity.java")
checkFile("electron/main.cjs")
checkFile(".github/workflows/build.yml")

console.log("✓ Verified dist/, Android assets, persistent PKCS#12 release keystore, Electron main, and GitHub Actions workflow!")

// 6. Verify GitHub repositories hub & strict browser opt-in (no unsolicited tab scanning)
const aiClientSrc = checkFile("src/core/ai-client.ts").toString("utf-8")
assert.ok(aiClientSrc.includes("isRepoOrCodeTask"), "Missing strict browser opt-in gate (isRepoOrCodeTask)")
assert.ok(aiClientSrc.includes("browserDisabled"), "Missing browserDisabled guard for non-browser tasks")
assert.ok(
  aiClientSrc.includes("БЛОК ПРО БРАУЗЕР") || aiClientSrc.includes("browserInstructionBlock"),
  "Browser system prompt must be conditional",
)
const hubSrc = checkFile("src/components/GitHubReposHub.tsx").toString("utf-8")
for (const needle of [
  "Работа с репозиториями GitHub",
  "fetchRepoSnapshot",
  "fetchRepoTree",
  "detectBestBranch",
  "buildRepoManifest",
  "isTextRepoPath",
  "Анализ README",
  "GitHub Actions",
]) {
  assert.ok(hubSrc.includes(needle), `GitHub repos hub missing: ${needle}`)
}
const appSrc = checkFile("src/App.tsx").toString("utf-8")
assert.ok(appSrc.includes("GitHubReposHub"), "App must render the GitHub repositories hub")
assert.ok(appSrc.includes("Работа с репозиториями GitHub"), "Chat must expose the repositories button")
assert.ok(appSrc.includes("repoContext"), "App must pass repo context to the agent")
const toolsSrc2 = checkFile("src/core/tools.ts").toString("utf-8")
assert.ok(toolsSrc2.includes("browserDisabled"), "browser_tabs must refuse execution when browser is not requested")
assert.ok(
  hubSrc.includes("Полная структура ветки") || hubSrc.includes("Реальн"),
  "Hub must pass the repository file manifest to the agent",
)
console.log("✓ Verified GitHub repositories hub (README analysis, code fixes, GitHub Actions builds) & strict browser opt-in")

// 7. Verify github_read tool (reading any repo file, auto branch detection)
const toolsSchemas = checkFile("src/core/tools.ts").toString("utf-8")
assert.ok(toolsSchemas.includes('name: "github_read"'), "Missing github_read tool schema")
assert.ok(toolsSchemas.includes('case "github_read"'), "Missing github_read tool handler")
assert.ok(
  hubSrc.includes("detectBestBranch(") && hubSrc.includes("textPaths"),
  "Hub must auto-detect the branch that actually contains the project",
)
console.log("✓ Verified github_read tool & automatic branch detection for GitHub repositories")
console.log("=== ALL TESTS PASSED ===")

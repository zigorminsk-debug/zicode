import { McpServerConfig, SkillItem } from "./types"

export const INITIAL_WORKSPACE_FILES: Record<string, string> = {
  "AGENTS.md": `# ZiCode / OpenCode Workspace Instructions

## Project Overview
This workspace is managed by **ZiCode** (100% OpenCode-compatible AI Coding Agent for Windows & Android).

## Commands
- \`npm run dev\` — Start local development server
- \`npm run build\` — Build production bundle & sync Android assets
- \`npm test\` — Run automated verification suite

## Architecture & Conventions
- \`src/core/\` — OpenCode Core Engine (Providers, \`models.dev\` Free Models, Agents, 17 Tools, Snapshot/Revert, MCP)
- \`electron/\` — Windows Desktop Electron Main & Preload process
- \`android/\` — Native Android APK Gradle project with persistent release signing key
`,
  "opencode.json": JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      model: "opencode/big-pickle",
      small_model: "opencode/glm-5.3-flash-free",
      theme: "opencode",
      autoupdate: true,
      provider: {
        opencode: {
          options: {
            apiKey: "public",
          },
        },
      },
      permission: {
        edit: "allow",
        bash: "allow",
        webfetch: "allow",
      },
    },
    null,
    2,
  ),
  "src/example/calculator.ts": `export interface CalculationResult {
  expression: string
  value: number
  timestamp: string
}

export function evaluateExpression(a: number, b: number, op: "+" | "-" | "*" | "/"): CalculationResult {
  let value = 0
  switch (op) {
    case "+":
      value = a + b
      break
    case "-":
      value = a - b
      break
    case "*":
      value = a * b
      break
    case "/":
      if (b === 0) throw new Error("Division by zero")
      value = a / b
      break
  }
  return {
    expression: \`\${a} \${op} \${b}\`,
    value,
    timestamp: new Date().toISOString(),
  }
}
`,
  ".opencode/plan/ROADMAP.md": `# Архитектурный план проекта

1. Свободное переключение между режимами **Build** и **Plan** клавишей \`Tab\`.
2. Использование бесплатных моделей OpenCode Zen (\`big-pickle\`, \`beam-free\`, \`deepseek-v4.1-flash-free\`, \`glm-5.3-flash-free\`, \`mimo-v2.6-flash-free\`, \`nemotron-3-ultra-free\`).
3. Полная поддержка всех 17 инструментов OpenCode и снимков состояния (\`/undo\`, \`/redo\`).
`,
}

export const BUILTIN_SKILLS: SkillItem[] = [
  {
    slug: "opencode-architecture",
    name: "OpenCode Architecture & Patterns",
    description: "Best practices for modular TypeScript, Effect-style services, and clean tool boundaries.",
    path: ".opencode/skills/opencode-architecture/SKILL.md",
    content: `# Skill: OpenCode Architecture
- Keep modules focused and strongly typed.
- Always read a file with \`read\` before modifying it with \`edit\` or \`patch\`.
- Verify changes using \`lsp_diagnostics\` or \`bash\` tests.`,
  },
  {
    slug: "android-windows-packaging",
    name: "Android APK & Windows EXE Packaging",
    description: "Instructions for building signed Android APKs via Gradle and Windows installers via Electron Builder.",
    path: ".opencode/skills/android-windows-packaging/SKILL.md",
    content: `# Skill: Android & Windows Packaging
- Android release builds use PKCS#12 keystore signing via \`ANDROID_KEYSTORE_BASE64\` in GitHub Secrets.
- Windows builds target NSIS installer and Portable executable via \`electron-builder --win --x64\`.`,
  },
  {
    slug: "security-audit",
    name: "Security & Code Review Audit",
    description: "Systematic security checklist for reviewing authentication, secrets, and shell execution.",
    path: ".opencode/skills/security-audit/SKILL.md",
    content: `# Skill: Security Audit
- Check for command injection, path traversal, hardcoded credentials, and unhandled promise rejections.
- Ensure sensitive keys remain in environment variables or GitHub Secrets.`,
  },
]

export const INITIAL_MCP_SERVERS: McpServerConfig[] = [
  {
    id: "mcp-filesystem",
    name: "OpenCode Workspace FS",
    transport: "stdio",
    urlOrCommand: "npx -y @modelcontextprotocol/server-filesystem .",
    enabled: true,
    status: "connected",
    tools: [
      {
        name: "fs_tree_summary",
        description: "Get a structured summary of workspace directories and file sizes",
        inputSchema: { type: "object", properties: { directory: { type: "string" } } },
      },
    ],
  },
  {
    id: "mcp-git",
    name: "OpenCode Git Inspector",
    transport: "stdio",
    urlOrCommand: "npx -y @modelcontextprotocol/server-git",
    enabled: true,
    status: "connected",
    tools: [
      {
        name: "git_log_summary",
        description: "Inspect recent commits and branch status",
        inputSchema: { type: "object", properties: { count: { type: "number" } } },
      },
    ],
  },
  {
    id: "mcp-context7",
    name: "Context7 Docs MCP",
    transport: "http",
    urlOrCommand: "https://mcp.context7.com/mcp",
    enabled: true,
    status: "connected",
    tools: [
      {
        name: "resolve_library_docs",
        description: "Fetch up-to-date documentation for any npm/PyPI/Android library",
        inputSchema: { type: "object", properties: { libraryName: { type: "string" } }, required: ["libraryName"] },
      },
    ],
  },
]

export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    cjs: "javascript",
    mjs: "javascript",
    json: "json",
    md: "markdown",
    py: "python",
    java: "java",
    kt: "kotlin",
    xml: "xml",
    gradle: "groovy",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    css: "css",
    html: "html",
  }
  return map[ext] ?? "plaintext"
}

export function createUnifiedDiff(filePath: string, oldText: string, newText: string): string {
  if (oldText === newText) return `--- a/${filePath}\n+++ b/${filePath}\n@@ No changes @@`
  const oldLines = oldText ? oldText.split("\n") : []
  const newLines = newText ? newText.split("\n") : []
  const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`, `@@ -1,${oldLines.length} +1,${newLines.length} @@`]

  const maxLines = Math.max(oldLines.length, newLines.length)
  let shown = 0
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i]
    const n = newLines[i]
    if (o === n) {
      if (shown < 40) {
        lines.push(` ${o ?? ""}`)
        shown++
      }
    } else {
      if (o !== undefined) lines.push(`-${o}`)
      if (n !== undefined) lines.push(`+${n}`)
      shown += 2
    }
    if (lines.length > 80) {
      lines.push("... (diff truncated) ...")
      break
    }
  }
  return lines.join("\n")
}

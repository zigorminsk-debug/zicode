import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  Download,
  FileCode,
  FilePlus,
  FolderGit2,
  GitBranch,
  History,
  KeyRound,
  Layers,
  ListTodo,
  Menu,
  Monitor,
  Palette,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react"
import { BUILTIN_AGENTS, PLAN_ENTER_REMINDER, PLAN_LEAVE_REMINDER } from "./core/agents"
import { runAgentTurn } from "./core/ai-client"
import { PROMPT_INITIALIZE, PROMPT_REVIEW, SLASH_COMMANDS } from "./core/commands"
import { BUILTIN_MODELS, PROVIDERS, syncModelsDevCatalog } from "./core/models-dev"
import { THEMES } from "./core/themes"
import { executeToolCall } from "./core/tools"
import {
  ArtifactItem,
  BrowserTabItem,
  ChatMessage,
  McpServerConfig,
  ModelInfo,
  QuestionPrompt,
  SessionInfo,
  TodoItem,
  ToolCallRecord,
  WorkspaceSnapshot,
} from "./core/types"
import {
  BUILTIN_SKILLS,
  INITIAL_MCP_SERVERS,
  INITIAL_WORKSPACE_FILES,
  createUnifiedDiff,
  detectLanguage,
} from "./core/workspace"
import {
  OpenCodeSettingsScreen,
  GitHubCollaborationView,
  HelpAndGuideView,
  SettingsTabId,
} from "./components/OpenCodeSettingsAndHelp"

function createInitialSession(): SessionInfo {
  const id = `ses_${Date.now().toString(36)}`
  return {
    id,
    affinityId: id,
    projectID: "zicode-workspace",
    title: "Новая сессия OpenCode",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    agentId: "build",
    providerId: "opencode",
    modelId: "big-pickle",
    reasoningEffort: "high",
    todos: [
      {
        id: "todo-1",
        content: "Анализ архитектуры OpenCode (anomalyco/opencode) и каталога models.dev",
        status: "completed",
        priority: "high",
      },
      {
        id: "todo-2",
        content: "Подключение бесплатных моделей OpenCode Zen (apiKey='public')",
        status: "completed",
        priority: "high",
      },
      {
        id: "todo-3",
        content: "Сборка Windows (.exe) и Android (.apk с постоянным ключом) в GitHub Actions",
        status: "completed",
        priority: "high",
      },
    ],
    snapshots: [],
    redoStack: [],
    compactedCount: 0,
    messages: [
      {
        id: "msg-welcome",
        role: "assistant",
        agentId: "build",
        providerId: "opencode",
        modelId: "big-pickle",
        timestamp: Date.now(),
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        content: `Добро пожаловать в **ZiCode v2.3** — полный кроссплатформенный аналог **OpenCode** для **Android** и **Windows**!

### Что включено (100% функционал OpenCode):
- **Бесплатные модели ИИ из коробки (\`$0 / Free\`, \`apiKey: "public"\`)**:
  - **OpenCode Zen**: \`big-pickle\`, \`beam-free\` (1M контекст), \`deepseek-v4.1-flash-free\`, \`glm-5.3-flash-free\`, \`mimo-v2.6-flash-free\`, \`flint-40b-free\`, \`nemotron-3-ultra-free\` (1M), \`nemotron-3.5-lightning-free\`, \`nemotron-3.5-super-vl-free\` (Vision), \`jev-1.13-free\`, \`grok-code\`, \`kimi-k2.5-free\`, \`minimax-m3.1-flash-free\`, \`qwen3.6-plus-free\` и др.
  - **Другие бесплатные провайдеры \`models.dev\`**: OpenRouter (\`openrouter/free\`, \`:free\`), Z.AI (\`glm-4.7-flash\`, \`glm-4.6v-flash\`), Google Gemini Free Tier, NVIDIA NIM Free, Groq, Alibaba Token Plan, AIHubMix, Vercel AI Gateway, Ollama.
- **Агенты OpenCode (переключение по \`Tab\`)**: \`Build\` (полный доступ), \`Plan\` (только чтение и проектирование с \`<system-reminder>\`), сабагенты \`@general\` и \`@explore\`.
- **Все 17 инструментов**: \`read\`, \`write\`, \`edit\`, \`patch\`, \`bash\`, \`glob\`, \`grep\`, \`webfetch\`, \`websearch\`, \`todowrite\`, \`todoread\`, \`task\`, \`question\`, \`skill\`, \`lsp_diagnostics\`, \`mcp_call\`, \`artifact\`.
- **Снимки состояния и команды**: \`/init\`, \`/review\`, \`/undo\`, \`/redo\`, \`/compact\`, \`/diff\`, \`/models\`, \`/themes\`, \`/mcp\`, упоминания \`@файл\` и прямой шелл \`!команда\`.`,
      },
    ],
  }
}

export function App() {
  // Workspace files state
  const [files, setFiles] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("zicode_files_v2")
      if (saved) return JSON.parse(saved)
    } catch {}
    return INITIAL_WORKSPACE_FILES
  })

  // Models catalog state
  const [models, setModels] = useState<ModelInfo[]>(BUILTIN_MODELS)
  const [syncStatus, setSyncStatus] = useState<string>("Встроенный каталог models.dev (40+ Free моделей)")
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>(() => {
    try {
      const saved = localStorage.getItem("zicode_sessions_v2")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [createInitialSession()]
  })
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id ?? "")

  // API keys & custom endpoints
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("zicode_apikeys_v2")
      if (saved) return JSON.parse(saved)
    } catch {}
    return { opencode: "public" }
  })
  const [customBaseUrls, setCustomBaseUrls] = useState<Record<string, string>>({})

  // MCP servers
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>(INITIAL_MCP_SERVERS)

  // Synced Chrome Browser Tabs (via ZiCode Chrome Extension)
  const [browserTabs, setBrowserTabs] = useState<BrowserTabItem[]>([])
  const [browserLastSync, setBrowserLastSync] = useState<number>(0)

  // Theme & UI mode
  const [themeId, setThemeId] = useState<string>(() => localStorage.getItem("zicode_theme") || "opencode")
  const [uiMode, setUiMode] = useState<"studio" | "tui">("studio")
  const [sidebarTab, setSidebarTab] = useState<"sessions" | "files" | "todos" | "snapshots" | "mcp" | "builds">("files")
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false)
  const [centerTab, setCenterTab] = useState<
    "chat" | "editor" | "diff" | "browser" | "github" | "help" | "architecture"
  >("chat")
  const [activeFilePath, setActiveFilePath] = useState<string>("opencode.json")

  // Modals & OpenCode Full-Screen Settings (image-4 & image-5)
  const [showModelModal, setShowModelModal] = useState(false)
  const [onlyFreeFilter, setOnlyFreeFilter] = useState(true)
  const [modelSearch, setModelSearch] = useState("")
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>("all")
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>("models")
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("zicode_enabled_models")
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  const handleCreateNewProject = (projectName: string, template: string) => {
    const cleanName = projectName.trim() || "my-zicode-project"
    const newFiles: Record<string, string> = {
      "opencode.json": JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          project: cleanName,
          provider: "opencode",
          model: "big-pickle",
          freeModelsEnabled: true,
        },
        null,
        2,
      ),
      "AGENTS.md": `# Проект: ${cleanName}\n\n## Архитектура и правила для ИИ-агента OpenCode\n- Шаблон: ${template}\n- Используйте строгую типизацию и модульную структуру.\n- Перед изменением файлов проверяйте зависимости через \`grep\` и \`lsp_diagnostics\`.\n`,
      "README.md": `# ${cleanName}\n\nПроект создан в среде **ZiCode (OpenCode Studio)**.\n`,
    }

    if (template === "python-api") {
      newFiles["src/main.py"] = `from fastapi import FastAPI\n\napp = FastAPI(title="${cleanName}")\n\n@app.get("/")\ndef read_root():\n    return {"project": "${cleanName}", "status": "ok"}\n`
      setActiveFilePath("src/main.py")
    } else if (template === "node-cli") {
      newFiles["src/server.js"] = `const http = require("node:http");\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "application/json" });\n  res.end(JSON.stringify({ project: "${cleanName}", ok: true }));\n});\n\nserver.listen(3000, () => console.log("${cleanName} listening on :3000"));\n`
      setActiveFilePath("src/server.js")
    } else if (template === "ts-app") {
      newFiles["src/index.ts"] = `export interface AppConfig {\n  name: string;\n  version: string;\n}\n\nexport function startApp(config: AppConfig): string {\n  return \`Запущен проект \${config.name} v\${config.version}\`;\n}\n\nconsole.log(startApp({ name: "${cleanName}", version: "1.0.0" }));\n`
      setActiveFilePath("src/index.ts")
    } else {
      setActiveFilePath("AGENTS.md")
    }

    setFiles(newFiles)
    setCenterTab("editor")
  }

  // Terminal drawer
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalInput, setTerminalInput] = useState("")
  const [terminalHistory, setTerminalHistory] = useState<{ cmd: string; output: string; isError?: boolean }[]>([
    {
      cmd: "opencode --version",
      output: "ZiCode / OpenCode Engine v2.3.0 (Windows x64 & Android Signed APK · Free Zen Models Enabled)",
    },
  ])

  // Prompt composer state
  const [promptInput, setPromptInput] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [streamingReasoning, setStreamingReasoning] = useState("")
  const [streamingTools, setStreamingTools] = useState<ToolCallRecord[]>([])
  const [activeArtifact, setActiveArtifact] = useState<ArtifactItem | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId],
  )

  const activeAgent = useMemo(
    () => BUILTIN_AGENTS.find((a) => a.id === activeSession.agentId) ?? BUILTIN_AGENTS[0],
    [activeSession.agentId],
  )

  const activeProvider = useMemo(
    () => PROVIDERS.find((p) => p.id === activeSession.providerId) ?? PROVIDERS[0],
    [activeSession.providerId],
  )

  const activeModel = useMemo(
    () =>
      models.find((m) => m.id === activeSession.modelId && m.providerID === activeSession.providerId) ??
      models.find((m) => m.id === activeSession.modelId) ??
      models[0],
    [models, activeSession.modelId, activeSession.providerId],
  )

  const activeTheme = useMemo(() => THEMES.find((t) => t.id === themeId) ?? THEMES[0], [themeId])

  // Apply CSS variables for selected OpenCode theme
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--bg-primary", activeTheme.bgPrimary)
    root.style.setProperty("--bg-secondary", activeTheme.bgSecondary)
    root.style.setProperty("--bg-tertiary", activeTheme.bgTertiary)
    root.style.setProperty("--bg-elevated", activeTheme.bgElevated)
    root.style.setProperty("--border-color", activeTheme.border)
    root.style.setProperty("--text-primary", activeTheme.textPrimary)
    root.style.setProperty("--text-secondary", activeTheme.textSecondary)
    root.style.setProperty("--text-muted", activeTheme.textMuted)
    root.style.setProperty("--accent", activeTheme.accent)
    root.style.setProperty("--accent-secondary", activeTheme.accentSecondary)
    root.style.setProperty("--success", activeTheme.success)
    root.style.setProperty("--warning", activeTheme.warning)
    root.style.setProperty("--danger", activeTheme.danger)
    localStorage.setItem("zicode_theme", activeTheme.id)
  }, [activeTheme])

  // Persist sessions, files, and API keys
  useEffect(() => {
    try {
      localStorage.setItem("zicode_sessions_v2", JSON.stringify(sessions))
    } catch {}
  }, [sessions])

  useEffect(() => {
    try {
      localStorage.setItem("zicode_files_v2", JSON.stringify(files))
    } catch {}
  }, [files])

  useEffect(() => {
    try {
      localStorage.setItem("zicode_apikeys_v2", JSON.stringify(apiKeys))
    } catch {}
  }, [apiKeys])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeSession.messages.length, streamingContent, streamingTools.length])

  // Listen for Chrome Extension sync events (both direct window.postMessage and /api/browser/tabs server store)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "ZICODE_BROWSER_SYNC" && event.data?.payload) {
        const incoming = event.data.payload
        if (Array.isArray(incoming.tabs)) {
          setBrowserTabs(incoming.tabs)
          setBrowserLastSync(Date.now())
        }
      }
    }
    window.addEventListener("message", onMessage)

    const pollServerTabs = async () => {
      try {
        const res = await fetch("/api/browser/tabs")
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.tabs) && data.tabs.length > 0) {
            setBrowserTabs(data.tabs)
            if (data.updatedAt) setBrowserLastSync(data.updatedAt)
          }
        }
      } catch {}
    }

    pollServerTabs()
    const timer = window.setInterval(pollServerTabs, 3500)
    return () => {
      window.removeEventListener("message", onMessage)
      window.clearInterval(timer)
    }
  }, [])

  // Keyboard shortcut: Tab switches Build <-> Plan (when not typing multiline or when pressing Alt+Tab / Shift+Tab)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab" && (e.shiftKey || document.activeElement?.tagName !== "TEXTAREA")) {
        e.preventDefault()
        togglePrimaryAgent()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setShowModelModal((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeSession])

  const updateActiveSession = (updater: (s: SessionInfo) => SessionInfo) => {
    setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? updater(s) : s)))
  }

  // Toggle Build <-> Plan with OpenCode <system-reminder> injection
  const togglePrimaryAgent = (targetId?: string) => {
    const nextId = targetId ?? (activeSession.agentId === "build" ? "plan" : "build")
    const prevId = activeSession.agentId
    if (nextId === prevId) return

    const reminderText =
      nextId === "plan" ? PLAN_ENTER_REMINDER : prevId === "plan" ? PLAN_LEAVE_REMINDER : undefined

    updateActiveSession((s) => ({
      ...s,
      agentId: nextId,
      updatedAt: Date.now(),
      messages: reminderText
        ? [
            ...s.messages,
            {
              id: `rem-${Date.now()}`,
              role: "system",
              content: reminderText,
              agentId: nextId,
              modelId: s.modelId,
              providerId: s.providerId,
              timestamp: Date.now(),
              isSyntheticReminder: true,
            },
          ]
        : s.messages,
    }))
  }

  // Sync models.dev live catalog
  const handleSyncCatalog = async () => {
    setIsSyncingCatalog(true)
    const res = await syncModelsDevCatalog(models)
    setModels(res.models)
    setSyncStatus(
      res.addedCount > 0
        ? `Синхронизировано с ${res.source} (+${res.addedCount} новых моделей, всего ${res.models.filter((m) => m.free).length} бесплатных)`
        : `Каталог актуален (${res.models.filter((m) => m.free).length} бесплатных моделей $0)`,
    )
    setIsSyncingCatalog(false)
  }

  // Undo / Redo Snapshot Engine
  const handleUndo = () => {
    if (activeSession.snapshots.length === 0) return
    const lastSnap = activeSession.snapshots[activeSession.snapshots.length - 1]
    const currentSnapshotFiles = { ...files }
    setFiles(lastSnap.files)
    updateActiveSession((s) => ({
      ...s,
      snapshots: s.snapshots.slice(0, -1),
      redoStack: [
        ...s.redoStack,
        {
          messages: s.messages,
          files: currentSnapshotFiles,
          todos: s.todos,
        },
      ],
      messages: s.messages.slice(0, -2),
    }))
  }

  const handleRedo = () => {
    if (activeSession.redoStack.length === 0) return
    const nextRedo = activeSession.redoStack[activeSession.redoStack.length - 1]
    const currentFiles = { ...files }
    setFiles(nextRedo.files)
    updateActiveSession((s) => ({
      ...s,
      redoStack: s.redoStack.slice(0, -1),
      snapshots: [
        ...s.snapshots,
        {
          id: `snap-${Date.now()}`,
          timestamp: Date.now(),
          label: "Redo restore point",
          files: currentFiles,
        },
      ],
      messages: nextRedo.messages,
      todos: nextRedo.todos,
    }))
  }

  // Compact Session (/compact)
  const handleCompactSession = () => {
    updateActiveSession((s) => {
      if (s.messages.length <= 2) return s
      const summaryMsg: ChatMessage = {
        id: `compact-${Date.now()}`,
        role: "assistant",
        agentId: "compaction",
        providerId: s.providerId,
        modelId: s.modelId,
        timestamp: Date.now(),
        content: `📦 **[Compaction Agent · /compact]** Сжато ${s.messages.length} сообщений истории. Сохранены ключевые архитектурные решения, текущие задачи (${s.todos.length} todos) и состояние ${Object.keys(files).length} файлов рабочей области.`,
      }
      return {
        ...s,
        compactedCount: s.compactedCount + 1,
        messages: [summaryMsg],
      }
    })
  }

  // Export Session (/export)
  const handleExportSession = () => {
    const mdLines = [
      `# ${activeSession.title}`,
      `- Session ID: \`${activeSession.id}\``,
      `- Agent: \`${activeAgent.name}\` | Model: \`${activeModel.name}\` (\`${activeProvider.id}/${activeModel.id}\`)`,
      "",
      ...activeSession.messages
        .filter((m) => !m.isSyntheticReminder)
        .map((m) => `## ${m.role.toUpperCase()} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n`),
    ]
    const blob = new Blob([mdLines.join("\n")], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeSession.id}-export.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Run Terminal Command
  const handleRunTerminalCommand = async (cmdText?: string) => {
    const cmd = (cmdText ?? terminalInput).trim()
    if (!cmd) return
    setTerminalInput("")
    const res = await executeToolCall(
      "bash",
      { command: cmd },
      {
        agent: BUILTIN_AGENTS[0],
        files,
        setFiles,
        todos: activeSession.todos,
        setTodos: (todos) => updateActiveSession((s) => ({ ...s, todos })),
        mcpServers,
      },
    )
    setTerminalHistory((prev) => [...prev, { cmd, output: res.output, isError: res.isError }])
  }

  // Submit Prompt / Slash Command / !shell / @file
  const handleSubmitPrompt = async (overrideText?: string) => {
    const raw = (overrideText ?? promptInput).trim()
    if (!raw || isRunning) return
    if (!overrideText) setPromptInput("")

    // 1. Direct shell execution via !command
    if (raw.startsWith("!")) {
      const shellCmd = raw.slice(1).trim()
      setShowTerminal(true)
      await handleRunTerminalCommand(shellCmd)
      return
    }

    // 2. Slash commands handling
    let effectivePrompt = raw
    if (raw.startsWith("/")) {
      const parts = raw.split(/\s+/)
      const cmd = parts[0].toLowerCase()
      const argText = parts.slice(1).join(" ")

      if (cmd === "/models" || cmd === "/model") {
        setShowModelModal(true)
        return
      }
      if (cmd === "/themes" || cmd === "/theme") {
        const idx = THEMES.findIndex((t) => t.id === themeId)
        const nextTheme = THEMES[(idx + 1) % THEMES.length]
        setThemeId(nextTheme.id)
        return
      }
      if (cmd === "/agent" || cmd === "/agents") {
        togglePrimaryAgent(argText || undefined)
        return
      }
      if (cmd === "/undo") {
        handleUndo()
        return
      }
      if (cmd === "/redo") {
        handleRedo()
        return
      }
      if (cmd === "/compact" || cmd === "/summarize") {
        handleCompactSession()
        return
      }
      if (cmd === "/new" || cmd === "/clear") {
        const s = createInitialSession()
        setSessions((prev) => [s, ...prev])
        setActiveSessionId(s.id)
        return
      }
      if (cmd === "/diff") {
        setCenterTab("diff")
        return
      }
      if (cmd === "/terminal" || cmd === "/sh") {
        setShowTerminal((v) => !v)
        return
      }
      if (cmd === "/mcp") {
        setSidebarTab("mcp")
        setSidebarOpenMobile(true)
        return
      }
      if (cmd === "/sessions" || cmd === "/resume") {
        setSidebarTab("sessions")
        setSidebarOpenMobile(true)
        return
      }
      if (cmd === "/export" || cmd === "/share") {
        handleExportSession()
        return
      }
      if (cmd === "/status" || cmd === "/cost") {
        const totalIn = activeSession.messages.reduce((acc, m) => acc + (m.tokensIn ?? 0), 0)
        const totalOut = activeSession.messages.reduce((acc, m) => acc + (m.tokensOut ?? 0), 0)
        const statusMsg: ChatMessage = {
          id: `status-${Date.now()}`,
          role: "assistant",
          agentId: activeAgent.id,
          providerId: activeProvider.id,
          modelId: activeModel.id,
          timestamp: Date.now(),
          content: `### Статус OpenCode (\`/status\`)\n- **Провайдер**: ${activeProvider.name} (\`${activeProvider.id}\`)\n- **Модель**: ${activeModel.name} (\`${activeModel.id}\`, контекст: ${activeModel.contextLimit.toLocaleString()} токенов)\n- **Тариф**: **${activeModel.free ? "БЕСПЛАТНО ($0.00 / Free)" : `$${activeModel.costInput}/M in`}**\n- **Агент**: \`${activeAgent.name}\` (\`${activeAgent.id}\`)\n- **Токены за сессию**: ${totalIn} вход / ${totalOut} выход\n- **Файлов в проекте**: ${Object.keys(files).length} | **Снимков (/undo)**: ${activeSession.snapshots.length}`,
        }
        updateActiveSession((s) => ({ ...s, messages: [...s.messages, statusMsg] }))
        return
      }
      if (cmd === "/help") {
        const helpMsg: ChatMessage = {
          id: `help-${Date.now()}`,
          role: "assistant",
          agentId: activeAgent.id,
          providerId: activeProvider.id,
          modelId: activeModel.id,
          timestamp: Date.now(),
          content:
            `### Справка по командам OpenCode (\`/help\`)\n\n` +
            SLASH_COMMANDS.map((c) => `- **\`${c.name}\`** — ${c.description}`).join("\n") +
            `\n\n**Дополнительно:**\n- Нажмите \`Tab\` для переключения агентов **Build** ↔ **Plan**.\n- Введите \`@имя_файла\` для прикрепления файла проекта в контекст.\n- Введите \`!команда\` для прямого запуска команды в терминале.`,
        }
        updateActiveSession((s) => ({ ...s, messages: [...s.messages, helpMsg] }))
        return
      }
      if (cmd === "/init") {
        effectivePrompt = PROMPT_INITIALIZE + (argText ? `\n\nFocus: ${argText}` : "")
      } else if (cmd === "/review") {
        effectivePrompt = PROMPT_REVIEW + (argText ? `\n\nTarget: ${argText}` : "")
      }
    }

    // 3. Expand @file mentions into context
    const mentionMatches = Array.from(effectivePrompt.matchAll(/@([a-zA-Z0-9_./-]+)/g))
    let attachedContext = ""
    for (const m of mentionMatches) {
      const fpath = m[1]
      if (files[fpath] !== undefined) {
        attachedContext += `\n\n<attached-file path="${fpath}">\n${files[fpath]}\n</attached-file>`
      }
    }

    // Create Snapshot before turn for /undo
    const snapshot: WorkspaceSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: raw.slice(0, 50),
      files: { ...files },
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: raw,
      agentId: activeAgent.id,
      providerId: activeProvider.id,
      modelId: activeModel.id,
      timestamp: Date.now(),
      snapshotId: snapshot.id,
    }

    // Auto-title session on first user prompt (Title Agent behavior)
    const nextTitle =
      activeSession.messages.length <= 1
        ? raw.replace(/^\/\w+\s*/, "").slice(0, 42) || activeSession.title
        : activeSession.title

    updateActiveSession((s) => ({
      ...s,
      title: nextTitle,
      updatedAt: Date.now(),
      snapshots: [...s.snapshots, snapshot],
      redoStack: [],
      messages: [...s.messages, userMsg],
    }))

    setIsRunning(true)
    setStreamingContent("")
    setStreamingReasoning("")
    setStreamingTools([])
    setCenterTab("chat")

    try {
      const result = await runAgentTurn({
        session: {
          ...activeSession,
          messages: [...activeSession.messages, userMsg],
        },
        agent: activeAgent,
        provider: activeProvider,
        model: activeModel,
        userPrompt: effectivePrompt + attachedContext,
        apiKeys,
        customBaseUrls,
        toolCtx: {
          agent: activeAgent,
          files,
          setFiles,
          todos: activeSession.todos,
          setTodos: (todos) => updateActiveSession((s) => ({ ...s, todos })),
          mcpServers,
          skills: BUILTIN_SKILLS,
          browserTabs,
          onArtifact: (art) => setActiveArtifact(art),
        },
        onUpdate: (partial) => {
          setStreamingContent(partial.content)
          setStreamingReasoning(partial.reasoning)
          setStreamingTools(partial.toolCalls)
        },
      })

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: result.content,
        reasoning: result.reasoning,
        toolCalls: result.toolCalls,
        question: result.question,
        artifact: result.artifact,
        agentId: activeAgent.id,
        providerId: activeProvider.id,
        modelId: activeModel.id,
        timestamp: Date.now(),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: result.costUsd,
      }

      updateActiveSession((s) => ({
        ...s,
        updatedAt: Date.now(),
        messages: [...s.messages, assistantMsg],
      }))
    } finally {
      setIsRunning(false)
      setStreamingContent("")
      setStreamingReasoning("")
      setStreamingTools([])
    }
  }

  // Autocomplete popups for `/` commands and `@` files
  const slashSuggestions = useMemo(() => {
    if (!promptInput.startsWith("/") || promptInput.includes(" ")) return []
    const q = promptInput.toLowerCase()
    return SLASH_COMMANDS.filter(
      (c) => c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)),
    ).slice(0, 8)
  }, [promptInput])

  const fileSuggestions = useMemo(() => {
    const match = promptInput.match(/@([a-zA-Z0-9_./-]*)$/)
    if (!match) return []
    const q = match[1].toLowerCase()
    return Object.keys(files)
      .filter((f) => f.toLowerCase().includes(q))
      .slice(0, 8)
  }, [promptInput, files])

  // Filtered models for Model Picker Modal
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (onlyFreeFilter && !m.free) return false
      if (selectedProviderFilter !== "all" && m.providerID !== selectedProviderFilter) return false
      if (modelSearch.trim()) {
        const q = modelSearch.toLowerCase()
        return (
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.providerID.toLowerCase().includes(q) ||
          (m.description ?? "").toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [models, onlyFreeFilter, selectedProviderFilter, modelSearch])

  // Session diffs calculation
  const sessionDiffs = useMemo(() => {
    const initial = activeSession.snapshots[0]?.files ?? INITIAL_WORKSPACE_FILES
    const allKeys = Array.from(new Set([...Object.keys(initial), ...Object.keys(files)])).sort()
    const list: { path: string; diff: string; status: "added" | "modified" | "deleted" }[] = []
    for (const k of allKeys) {
      const oldVal = initial[k]
      const newVal = files[k]
      if (oldVal === newVal) continue
      if (oldVal === undefined && newVal !== undefined) {
        list.push({ path: k, diff: createUnifiedDiff(k, "", newVal), status: "added" })
      } else if (oldVal !== undefined && newVal === undefined) {
        list.push({ path: k, diff: createUnifiedDiff(k, oldVal, ""), status: "deleted" })
      } else if (oldVal !== undefined && newVal !== undefined) {
        list.push({ path: k, diff: createUnifiedDiff(k, oldVal, newVal), status: "modified" })
      }
    }
    return list
  }, [activeSession.snapshots, files])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* =====================================================================
          TOP HEADER BAR (OpenCode Studio & TUI Header)
         ===================================================================== */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          gap: "10px",
          flexWrap: "wrap",
          zIndex: 20,
        }}
      >
        {/* Left: Menu + Brand + Agent Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setSidebarOpenMobile((v) => !v)}
            title="Боковая панель"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "6px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Menu size={16} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                background: "linear-gradient(135deg, var(--accent), var(--accent-secondary))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "14px",
                color: "#0a0c10",
              }}
            >
              OC
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "14px" }}>
                <span>ZiCode</span>
                <span
                  className="mono"
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    background: "var(--bg-tertiary)",
                    color: "var(--accent)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  OpenCode v2.3
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Android APK + Windows EXE</div>
            </div>
          </div>

          {/* Agent Switcher (Tab) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: "7px",
              padding: "2px",
              gap: "2px",
            }}
          >
            {BUILTIN_AGENTS.map((ag) => {
              const active = ag.id === activeAgent.id
              return (
                <button
                  key={ag.id}
                  onClick={() => togglePrimaryAgent(ag.id)}
                  title={`${ag.description} (Клавиша Tab)`}
                  style={{
                    padding: "4px 9px",
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: active ? ag.color : "transparent",
                    color: active ? "#0a0c10" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {ag.name.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Center: Active Free Model Selector Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setShowModelModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <Sparkles size={14} color="var(--accent)" />
            <span style={{ fontWeight: 600 }}>{activeModel.name}</span>
            {activeModel.free && (
              <span
                className="mono"
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: "rgba(34, 197, 94, 0.18)",
                  color: "var(--success)",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                }}
              >
                FREE $0
              </span>
            )}
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>

          {/* Reasoning Effort Selector */}
          {activeModel.capabilities.reasoning && (
            <select
              value={activeSession.reasoningEffort}
              onChange={(e) =>
                updateActiveSession((s) => ({
                  ...s,
                  reasoningEffort: e.target.value as any,
                }))
              }
              title="Уровень глубины рассуждений (Reasoning Effort)"
              style={{
                padding: "5px 8px",
                borderRadius: "6px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              <option value="low">Effort: Low</option>
              <option value="medium">Effort: Medium</option>
              <option value="high">Effort: High</option>
              <option value="xhigh">Effort: XHigh</option>
              <option value="max">Effort: Max</option>
            </select>
          )}
        </div>

        {/* Right: Undo/Redo, UI Mode (Studio/TUI), Theme, Builds */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={handleUndo}
            disabled={activeSession.snapshots.length === 0}
            title="Откатить шаг и файлы (/undo)"
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              cursor: activeSession.snapshots.length ? "pointer" : "not-allowed",
              opacity: activeSession.snapshots.length ? 1 : 0.4,
            }}
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleRedo}
            disabled={activeSession.redoStack.length === 0}
            title="Повторить шаг (/redo)"
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              cursor: activeSession.redoStack.length ? "pointer" : "not-allowed",
              opacity: activeSession.redoStack.length ? 1 : 0.4,
            }}
          >
            <RotateCw size={14} />
          </button>

          <button
            onClick={() => setUiMode((m) => (m === "studio" ? "tui" : "studio"))}
            title="Переключить режим Studio GUI / Classic OpenCode TUI"
            className="mono"
            style={{
              padding: "5px 9px",
              borderRadius: "6px",
              background: uiMode === "tui" ? "var(--accent)" : "var(--bg-tertiary)",
              color: uiMode === "tui" ? "#0a0c10" : "var(--text-primary)",
              border: "1px solid var(--border-color)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {uiMode === "tui" ? "TUI MODE" : "STUDIO GUI"}
          </button>

          <button
            onClick={() => {
              const idx = THEMES.findIndex((t) => t.id === themeId)
              setThemeId(THEMES[(idx + 1) % THEMES.length].id)
            }}
            title={`Тема: ${activeTheme.name} (/themes)`}
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              cursor: "pointer",
            }}
          >
            <Palette size={14} />
          </button>

          <button
            onClick={() => setCenterTab("help")}
            title="Полная справка: как настроить программу, создать проект, подключить GitHub и Chrome"
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              background: centerTab === "help" ? "var(--accent)" : "var(--bg-tertiary)",
              color: centerTab === "help" ? "#0a0c10" : "var(--text-primary)",
              border: "1px solid var(--border-color)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            <span>📖 Справка</span>
          </button>

          <button
            onClick={() => {
              setSettingsInitialTab("models")
              setShowSettingsModal(true)
            }}
            title="Полноэкранное меню настроек OpenCode (Провайдеры, Модели OpenCode Free, Расширения, Проекты)"
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--accent)",
              color: "#0a0c10",
              border: "1px solid var(--border-color)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            <Settings size={14} />
            <span>Меню / Модели</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN BODY (Sidebar + Center Area)
         ===================================================================== */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* LEFT SIDEBAR */}
        <aside
          style={{
            width: "290px",
            minWidth: "260px",
            background: "var(--bg-secondary)",
            borderRight: "1px solid var(--border-color)",
            display: sidebarOpenMobile || window.innerWidth >= 900 ? "flex" : "none",
            flexDirection: "column",
            position: window.innerWidth < 900 ? "absolute" : "relative",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 15,
          }}
        >
          {/* Sidebar Navigation Icons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              padding: "6px",
              gap: "4px",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
            }}
          >
            {[
              { id: "files", icon: <FileCode size={14} />, label: "Файлы" },
              { id: "sessions", icon: <Layers size={14} />, label: "Сессии" },
              { id: "todos", icon: <ListTodo size={14} />, label: "Задачи" },
              { id: "snapshots", icon: <History size={14} />, label: "Снимки" },
              { id: "mcp", icon: <Server size={14} />, label: "MCP" },
              { id: "builds", icon: <Download size={14} />, label: "Сборки" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id as any)}
                title={tab.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "3px",
                  padding: "6px 2px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "9px",
                  background: sidebarTab === tab.id ? "var(--bg-elevated)" : "transparent",
                  color: sidebarTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
            {sidebarTab === "files" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                    ФАЙЛЫ ПРОЕКТА ({Object.keys(files).length})
                  </span>
                  <button
                    onClick={() => {
                      const name = prompt("Имя нового файла (например src/newFile.ts):")
                      if (name && name.trim()) {
                        const clean = name.trim().replace(/^\/+/, "")
                        setFiles((prev) => ({ ...prev, [clean]: "// New file\n" }))
                        setActiveFilePath(clean)
                        setCenterTab("editor")
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 7px",
                      borderRadius: "5px",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    <FilePlus size={12} /> Новый
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {Object.keys(files)
                    .sort()
                    .map((path) => {
                      const isSelected = path === activeFilePath && centerTab === "editor"
                      return (
                        <div
                          key={path}
                          onClick={() => {
                            setActiveFilePath(path)
                            setCenterTab("editor")
                          }}
                          className="mono"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            cursor: "pointer",
                            background: isSelected ? "var(--bg-elevated)" : "transparent",
                            color: isSelected ? "var(--accent)" : "var(--text-primary)",
                            border: isSelected ? "1px solid var(--border-color)" : "1px solid transparent",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {path}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                            {files[path].split("\n").length}L
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {sidebarTab === "sessions" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                    СЕССИИ OPENCODE ({sessions.length})
                  </span>
                  <button
                    onClick={() => {
                      const s = createInitialSession()
                      setSessions((prev) => [s, ...prev])
                      setActiveSessionId(s.id)
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 7px",
                      borderRadius: "5px",
                      background: "var(--accent)",
                      color: "#0a0c10",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={12} /> Новая
                  </button>
                </div>

                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "7px",
                      marginBottom: "6px",
                      cursor: "pointer",
                      background: s.id === activeSession.id ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                      border:
                        s.id === activeSession.id
                          ? "1px solid var(--accent)"
                          : "1px solid var(--border-color)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>{s.title}</div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span className="mono">{s.modelId}</span>
                      <span>{s.messages.length} сообщ.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === "todos" && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  ЗАДАЧИ СЕССИИ (TODOWRITE · {activeSession.todos.length})
                </div>
                {activeSession.todos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => {
                      const nextStatus =
                        todo.status === "completed"
                          ? "pending"
                          : todo.status === "pending"
                            ? "in_progress"
                            : "completed"
                      updateActiveSession((s) => ({
                        ...s,
                        todos: s.todos.map((t) => (t.id === todo.id ? { ...t, status: nextStatus } : t)),
                      }))
                    }}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <CheckCircle2
                        size={13}
                        color={
                          todo.status === "completed"
                            ? "var(--success)"
                            : todo.status === "in_progress"
                              ? "var(--accent)"
                              : "var(--text-muted)"
                        }
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color:
                            todo.status === "completed"
                              ? "var(--success)"
                              : todo.status === "in_progress"
                                ? "var(--accent)"
                                : "var(--text-muted)",
                        }}
                      >
                        {todo.status} · {todo.priority}
                      </span>
                    </div>
                    <div
                      style={{
                        textDecoration: todo.status === "completed" ? "line-through" : "none",
                        color: todo.status === "completed" ? "var(--text-muted)" : "var(--text-primary)",
                      }}
                    >
                      {todo.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === "snapshots" && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  СНИМКИ СОСТОЯНИЯ ({activeSession.snapshots.length})
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
                  Перед каждым шагом агента создаётся снимок файлов. Нажмите «Восстановить» или введите <code>/undo</code>.
                </p>
                {activeSession.snapshots.map((snap, i) => (
                  <div
                    key={snap.id}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      fontSize: "11px",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "3px" }}>
                      #{i + 1}: {snap.label}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => setFiles(snap.files)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-color)",
                          cursor: "pointer",
                        }}
                      >
                        Восстановить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === "mcp" && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  СЕРВЕРЫ MCP ({mcpServers.length})
                </div>
                {mcpServers.map((srv) => (
                  <div
                    key={srv.id}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      fontSize: "11px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{srv.name}</span>
                      <span style={{ color: "var(--success)", fontSize: "10px" }}>● {srv.status}</span>
                    </div>
                    <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                      {srv.transport.toUpperCase()}: {srv.urlOrCommand}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === "builds" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                  ПРЯМЫЕ ССЫЛКИ ДЛЯ СКАЧИВАНИЯ (GITHUB RELEASES v2.3.0)
                </div>

                <div
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, marginBottom: "4px" }}>
                    <Smartphone size={14} color="var(--success)" />
                    <span>Android Signed Release APK</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "8px" }}>
                    Пакет: <code className="mono">ai.zicode.opencode</code>
                    <br />
                    Подпись: Постоянный ключ PKCS#12 (<code className="mono">zicode-key</code>, V1+V2+V3) из GitHub Secrets{" "}
                    <code className="mono">ANDROID_KEYSTORE_BASE64</code>.
                  </div>
                  <a
                    href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.5.0/ZiCode-Android-v2.5.0-Signed-Release.apk"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "var(--success)",
                      color: "#0a0c10",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: "11px",
                    }}
                  >
                    <Download size={12} /> Скачать APK (Direct)
                  </a>
                </div>

                <div
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, marginBottom: "4px" }}>
                    <Monitor size={14} color="var(--accent-secondary)" />
                    <span>Windows Desktop (.exe)</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "8px" }}>
                    Сборка: Electron Builder (<code className="mono">windows-latest</code>)
                    <br />
                    Артефакты: <code className="mono">ZiCode-Setup-2.3.0-x64.exe</code> +{" "}
                    <code className="mono">ZiCode-Portable-2.3.0-x64.exe</code>.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <a
                      href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.5.0/ZiCode-Setup-2.5.0-x64.exe"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "var(--accent)",
                        color: "#0a0c10",
                        fontWeight: 700,
                        textDecoration: "none",
                        fontSize: "11px",
                      }}
                    >
                      <Download size={12} /> Скачать Setup .exe
                    </a>
                    <a
                      href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.5.0/ZiCode-Portable-2.5.0-x64.exe"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-color)",
                        fontWeight: 600,
                        textDecoration: "none",
                        fontSize: "11px",
                      }}
                    >
                      <Download size={12} /> Скачать Portable .exe
                    </a>
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, marginBottom: "4px" }}>
                    <Sparkles size={14} color="var(--accent)" />
                    <span>Расширение для Google Chrome</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "8px" }}>
                    Позволяет ZiCode видеть открытые вкладки вашего браузера и читать текст страниц в реальном времени.
                  </div>
                  <a
                    href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.5.0/ZiCode-Chrome-Extension-v2.5.0.zip"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "var(--accent-secondary)",
                      color: "#0a0c10",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: "11px",
                    }}
                  >
                    <Download size={12} /> Скачать Chrome Extension (.zip)
                  </a>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER WORKSPACE */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Workspace Sub-Navigation Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 14px",
              background: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-color)",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {[
                { id: "chat", label: "Диалог с агентом", icon: <Bot size={13} /> },
                { id: "editor", label: `Редактор (${activeFilePath})`, icon: <Code2 size={13} /> },
                { id: "diff", label: `Diff изменений (${sessionDiffs.length})`, icon: <GitBranch size={13} /> },
                { id: "browser", label: `🌐 Браузер Chrome (${browserTabs.length})`, icon: <Search size={13} /> },
                { id: "github", label: "🐙 GitHub API (Совместная работа)", icon: <FolderGit2 size={13} /> },
                { id: "help", label: "📖 Справка и как создать проект", icon: <Sparkles size={13} /> },
                { id: "architecture", label: "Анализ OpenCode & Ключ Android", icon: <ShieldCheck size={13} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCenterTab(t.id as any)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: centerTab === t.id ? "var(--accent)" : "transparent",
                    background: centerTab === t.id ? "var(--bg-elevated)" : "transparent",
                    color: centerTab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowTerminal((v) => !v)}
              className="mono"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 9px",
                borderRadius: "6px",
                background: showTerminal ? "var(--accent)" : "var(--bg-tertiary)",
                color: showTerminal ? "#0a0c10" : "var(--text-secondary)",
                border: "1px solid var(--border-color)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              <Terminal size={13} />
              <span>Терминал</span>
            </button>
          </div>

          {/* =================================================================
              TAB 1: CHAT & AGENT EXECUTION STREAM
             ================================================================= */}
          {centerTab === "chat" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                fontFamily: uiMode === "tui" ? "var(--font-mono)" : "var(--font-sans)",
              }}
            >
              {/* Quick Action Starters */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[
                  { label: "🚀 /init (Создать AGENTS.md)", cmd: "/init" },
                  { label: "🔍 /review (Ревью кода)", cmd: "/review" },
                  { label: "⚡ Создай файл src/api/router.ts", cmd: "Создай файл src/api/router.ts с REST роутером" },
                  { label: "🆓 Список бесплатных моделей ($0)", cmd: "/models" },
                  { label: "📊 /status (Статус и токены)", cmd: "/status" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleSubmitPrompt(chip.cmd)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "999px",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      fontSize: "11px",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Messages List */}
              {activeSession.messages.map((msg) => {
                if (msg.isSyntheticReminder) {
                  return (
                    <div
                      key={msg.id}
                      className="mono"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "rgba(56, 189, 248, 0.1)",
                        border: "1px dashed var(--accent-secondary)",
                        fontSize: "11px",
                        color: "var(--accent-secondary)",
                      }}
                    >
                      ⚡ Переключен режим агента: <strong>{msg.agentId.toUpperCase()}</strong> (внедрён{" "}
                      <code>&lt;system-reminder&gt;</code> OpenCode)
                    </div>
                  )
                }

                const isUser = msg.role === "user"
                return (
                  <div
                    key={msg.id}
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: isUser ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderLeft: isUser ? "3px solid var(--accent-secondary)" : "3px solid var(--accent)",
                    }}
                  >
                    {/* Message Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                        fontSize: "11px",
                        color: "var(--text-muted)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            color: isUser ? "var(--accent-secondary)" : "var(--accent)",
                          }}
                        >
                          {isUser ? "ВЫ (USER)" : `OPENCODE [${msg.agentId.toUpperCase()}]`}
                        </span>
                        <span className="mono">
                          {msg.providerId}/{msg.modelId}
                        </span>
                      </div>
                      <div className="mono" style={{ display: "flex", gap: "10px" }}>
                        {msg.costUsd !== undefined && (
                          <span style={{ color: "var(--success)" }}>
                            {msg.costUsd === 0 ? "FREE ($0.00)" : `$${msg.costUsd}`}
                          </span>
                        )}
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Reasoning Trace */}
                    {msg.reasoning && (
                      <details
                        style={{
                          marginBottom: "10px",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--text-muted)" }}>
                          🧠 Мыслительный процесс модели (Reasoning Trace)
                        </summary>
                        <div className="mono" style={{ marginTop: "6px", whiteSpace: "pre-wrap" }}>
                          {msg.reasoning}
                        </div>
                      </details>
                    )}

                    {/* Tool Calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                        {msg.toolCalls.map((tc) => (
                          <details
                            key={tc.id}
                            style={{
                              padding: "8px 10px",
                              borderRadius: "6px",
                              background: "var(--bg-primary)",
                              border: "1px solid var(--border-color)",
                              fontSize: "11px",
                            }}
                          >
                            <summary
                              className="mono"
                              style={{
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>
                                🔧 <strong>{tc.name}</strong>(
                                {tc.args?.filePath
                                  ? `"${tc.args.filePath}"${tc.args.content ? `, ${String(tc.args.content).length} симв.` : ""}`
                                  : JSON.stringify(tc.args).length > 85
                                    ? `${JSON.stringify(tc.args).slice(0, 85)}…`
                                    : JSON.stringify(tc.args)}
                                )
                              </span>
                              <span
                                style={{
                                  color: tc.status === "error" ? "var(--danger)" : "var(--success)",
                                }}
                              >
                                {tc.status.toUpperCase()} {tc.durationMs !== undefined ? `(${tc.durationMs}ms)` : ""}
                              </span>
                            </summary>
                            {tc.output && (
                              <pre
                                className="mono"
                                style={{
                                  marginTop: "6px",
                                  padding: "8px",
                                  background: "var(--bg-secondary)",
                                  borderRadius: "5px",
                                  overflowX: "auto",
                                  fontSize: "11px",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {tc.output}
                              </pre>
                            )}
                            {tc.diff && (
                              <pre
                                className="mono"
                                style={{
                                  marginTop: "6px",
                                  padding: "8px",
                                  background: "#090d14",
                                  borderRadius: "5px",
                                  overflowX: "auto",
                                  fontSize: "11px",
                                  color: "#cbd5e1",
                                }}
                              >
                                {tc.diff}
                              </pre>
                            )}
                          </details>
                        ))}
                      </div>
                    )}

                    {/* Message Text */}
                    <div
                      style={{
                        fontSize: "13px",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Interactive Question Card */}
                    {msg.question && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "10px",
                          borderRadius: "8px",
                          background: "var(--bg-tertiary)",
                          border: "1px solid var(--accent)",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "8px" }}>
                          ❓ {msg.question.question}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {msg.question.options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleSubmitPrompt(opt.label)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "6px",
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-color)",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Streaming Turn Indicator */}
              {isRunning && (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--accent)",
                  }}
                >
                  <div
                    className="animate-pulse-glow mono"
                    style={{ fontSize: "11px", color: "var(--accent)", marginBottom: "8px" }}
                  >
                    ⚡ {activeModel.name} выполняет задачу ({activeAgent.name.toUpperCase()})...
                  </div>
                  {streamingReasoning && (
                    <div
                      className="mono"
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginBottom: "8px",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {streamingReasoning}
                    </div>
                  )}
                  {streamingTools.map((tc) => (
                    <div
                      key={tc.id}
                      className="mono"
                      style={{
                        fontSize: "11px",
                        padding: "4px 8px",
                        marginBottom: "4px",
                        background: "var(--bg-primary)",
                        borderRadius: "4px",
                      }}
                    >
                      🔧 {tc.name}: {tc.status}
                    </div>
                  ))}
                  {streamingContent && (
                    <div style={{ fontSize: "13px", whiteSpace: "pre-wrap" }}>{streamingContent}</div>
                  )}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* =================================================================
              TAB 2: INTEGRATED CODE EDITOR
             ================================================================= */}
          {centerTab === "editor" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="mono" style={{ fontSize: "12px", fontWeight: 700 }}>
                  📄 {activeFilePath} ({detectLanguage(activeFilePath)})
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleSubmitPrompt(`Проанализируй файл @${activeFilePath} и предложи улучшения`)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--accent)",
                      color: "#0a0c10",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Спросить OpenCode об этом файле
                  </button>
                </div>
              </div>
              <textarea
                value={files[activeFilePath] ?? ""}
                onChange={(e) => {
                  const val = e.target.value
                  setFiles((prev) => ({ ...prev, [activeFilePath]: val }))
                }}
                className="mono"
                style={{
                  flex: 1,
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  resize: "none",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* =================================================================
              TAB 3: UNIFIED DIFF VIEWER (/diff)
             ================================================================= */}
          {centerTab === "diff" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>
                Изменения файлов в рабочей области ({sessionDiffs.length})
              </h3>
              {sessionDiffs.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  В текущей сессии ещё нет изменённых файлов. Попросите агента создать или изменить файл.
                </div>
              ) : (
                sessionDiffs.map((item) => (
                  <div
                    key={item.path}
                    style={{
                      marginBottom: "12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        padding: "6px 12px",
                        background: "var(--bg-secondary)",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {item.status.toUpperCase()}: {item.path}
                    </div>
                    <pre
                      className="mono"
                      style={{
                        padding: "10px",
                        background: "var(--bg-primary)",
                        fontSize: "11px",
                        overflowX: "auto",
                      }}
                    >
                      {item.diff}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}

          {/* =================================================================
              TAB 3.5: CHROME BROWSER BRIDGE & OPEN TABS INSPECTOR
             ================================================================= */}
          {centerTab === "browser" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "18px", lineHeight: 1.6, fontSize: "13px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", color: "var(--accent)", marginBottom: "4px" }}>
                    🌐 ZiCode Chrome Bridge — Чтение открытых вкладок браузера
                  </h2>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Синхронизировано вкладок: <b>{browserTabs.length}</b>{" "}
                    {browserLastSync > 0 && (
                      <span>· Обновлено в {new Date(browserLastSync).toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a
                    href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.5.0/ZiCode-Chrome-Extension-v2.5.0.zip"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 12px",
                      borderRadius: "6px",
                      background: "var(--accent)",
                      color: "#0a0c10",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: "12px",
                    }}
                  >
                    <Download size={14} /> Скачать расширение для Chrome (.zip)
                  </a>
                  <button
                    onClick={() => {
                      window.postMessage({ type: "ZICODE_REQUEST_BROWSER_SYNC" }, "*")
                      fetch("/api/browser/tabs")
                        .then((r) => r.json())
                        .then((d) => {
                          if (Array.isArray(d?.tabs)) setBrowserTabs(d.tabs)
                        })
                        .catch(() => {})
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    🔄 Обновить вкладки
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "16px",
                  fontSize: "12px",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--accent-secondary)", marginBottom: "6px" }}>
                  Как установить расширение в Google Chrome / Edge / Brave / Яндекс.Браузер за 30 секунд:
                </div>
                <ol style={{ paddingLeft: "18px", color: "var(--text-secondary)", margin: 0 }}>
                  <li>
                    Скачайте архив{" "}
                    <a
                      href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.5.0/ZiCode-Chrome-Extension-v2.5.0.zip"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent)" }}
                    >
                      ZiCode-Chrome-Extension-v2.5.0.zip
                    </a>{" "}
                    и распакуйте его в любую папку на компьютере (или используйте папку <code>chrome-extension/</code> из
                    репозитория).
                  </li>
                  <li>
                    Откройте в браузере страницу <code>chrome://extensions</code> и включите переключатель{" "}
                    <b>«Режим разработчика» (Developer mode)</b> в правом верхнем углу.
                  </li>
                  <li>
                    Нажмите кнопку <b>«Загрузить распакованное расширение» (Load unpacked)</b> и выберите распакованную
                    папку.
                  </li>
                  <li>
                    Готово! Расширение автоматически передаёт открытые вкладки и их содержимое в ZiCode (и в десктопную
                    программу Windows через <code>127.0.0.1:4096</code>, и в веб-интерфейс). Теперь вы можете просто
                    написать в чате: <i>«Прочитай мою открытую вкладку и объясни о чём там речь»</i> или{" "}
                    <i>«Какие вкладки у меня сейчас открыты в Chrome?»</i>
                  </li>
                </ol>
              </div>

              {browserTabs.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px dashed var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Пока нет синхронизированных вкладок из расширения Chrome. Установите расширение по инструкции выше или
                  нажмите иконку <b>ZiCode Chrome Bridge</b> в панели расширений браузера.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {browserTabs.map((t, i) => (
                    <div
                      key={`${t.id}-${i}`}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background: "var(--bg-secondary)",
                        border: t.active ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          marginBottom: "6px",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                          {t.active && (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "var(--accent)",
                                color: "#0a0c10",
                                fontSize: "10px",
                                fontWeight: 700,
                                marginRight: "8px",
                              }}
                            >
                              АКТИВНАЯ ВКЛАДКА
                            </span>
                          )}
                          {t.title || "Без заголовка"}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              setCenterTab("chat")
                              handleSubmitPrompt(
                                `Прочитай открытую вкладку браузера "${t.title}" (${t.url}), извлеки все заголовки писем, сообщения, таблицы и сделай подробный разбор её содержимого.`,
                              )
                            }}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "var(--accent)",
                              color: "#0a0c10",
                              fontWeight: 700,
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            📬 Прочитать письма / данные вкладки
                          </button>
                          <button
                            onClick={() => {
                              setCenterTab("chat")
                              setPromptInput(
                                `Во вкладке "${t.title}" ответь от моего имени отправителю [укажите имя или тему]: `,
                              )
                            }}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "var(--bg-elevated)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border-color)",
                              fontWeight: 600,
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            ✉️ Ответить от моего имени
                          </button>
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: "11px", color: "var(--accent-secondary)", marginBottom: "6px" }}>
                        {t.url} · {(t.content || "").length} симв. извлечено
                      </div>
                      {t.content && (
                        <div
                          style={{
                            padding: "8px",
                            borderRadius: "6px",
                            background: "var(--bg-primary)",
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            maxHeight: "180px",
                            overflowY: "auto",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {t.content.slice(0, 2000)}
                          {t.content.length > 2000 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 3.6: GITHUB API COLLABORATION (Подключение к GitHub по API-ключу)
             ================================================================= */}
          {centerTab === "github" && (
            <GitHubCollaborationView
              files={files}
              setFiles={setFiles}
              onSelectFile={(path) => {
                setActiveFilePath(path)
                setCenterTab("editor")
              }}
            />
          )}

          {/* =================================================================
              TAB 3.7: IN-APP HELP & PROJECT CREATION GUIDE («📖 Справка»)
             ================================================================= */}
          {centerTab === "help" && (
            <HelpAndGuideView
              onOpenSettings={(tab) => {
                setSettingsInitialTab(tab)
                setShowSettingsModal(true)
              }}
              onOpenGitHub={() => setCenterTab("github")}
              onOpenBrowserTab={() => setCenterTab("browser")}
              onCreateNewProject={handleCreateNewProject}
            />
          )}

          {/* =================================================================
              TAB 4: OPENCODE ARCHITECTURE ANALYSIS & ANDROID SIGNING KEY INFO
             ================================================================= */}
          {centerTab === "architecture" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "18px", lineHeight: 1.6, fontSize: "13px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "10px", color: "var(--accent)" }}>
                Технический анализ OpenCode (anomalyco/opencode) и сборка Android + Windows
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <h4 style={{ color: "var(--success)", marginBottom: "6px" }}>
                    1. Как работают бесплатные модели в OpenCode
                  </h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    В <code>packages/core/src/plugin/provider/opencode.ts</code> плагин <code>OpencodePlugin</code> при
                    отсутствии платного ключа автоматически выставляет <code>apiKey: &quot;public&quot;</code> и включает
                    все модели из <code>models.dev</code> со стоимостью <code>cost.input === 0</code>, отправляя запросы на{" "}
                    <code>https://opencode.ai/inference/openai/v1</code> и{" "}
                    <code>https://opencode.ai/inference/anthropic/v1</code>.
                  </p>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <h4 style={{ color: "var(--accent-secondary)", marginBottom: "6px" }}>
                    2. Постоянный ключ подписи Android APK (GitHub Secrets)
                  </h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Сгенерирован постоянный RSA-2048 PKCS#12 ключ (срок действия до 2054 г.):
                    <br />
                    Alias: <code className="mono">zicode-key</code>
                    <br />
                    SHA-256: <code className="mono">47:D7:9F:24:7A:E2:10:35:A6:74:5B:A7...</code>
                    <br />
                    Workflow в GitHub Actions читает <code>secrets.ANDROID_KEYSTORE_BASE64</code>,{" "}
                    <code>secrets.ANDROID_KEYSTORE_PASSWORD</code>, <code>secrets.ANDROID_KEY_ALIAS</code>,{" "}
                    <code>secrets.ANDROID_KEY_PASSWORD</code>.
                  </p>
                </div>
              </div>

              <pre
                className="mono"
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "11px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {files["AGENTS.md"] ?? ""}
              </pre>
            </div>
          )}

          {/* =================================================================
              INTEGRATED TERMINAL DRAWER
             ================================================================= */}
          {showTerminal && (
            <div
              style={{
                height: "190px",
                background: "#07090d",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                padding: "8px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                }}
              >
                <span className="mono">TERMINAL (PowerShell / Bash / Android sh)</span>
                <button
                  onClick={() => setShowTerminal(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mono" style={{ flex: 1, overflowY: "auto", fontSize: "11px" }}>
                {terminalHistory.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: "6px" }}>
                    <div style={{ color: "var(--accent)" }}>$ {item.cmd}</div>
                    <div
                      style={{
                        color: item.isError ? "var(--danger)" : "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {item.output}
                    </div>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleRunTerminalCommand()
                }}
                style={{ display: "flex", gap: "6px", marginTop: "6px" }}
              >
                <span className="mono" style={{ color: "var(--accent)", fontSize: "12px" }}>
                  $
                </span>
                <input
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="Введите команду (например: git status, ls, cat opencode.json)..."
                  className="mono"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: "12px",
                  }}
                />
              </form>
            </div>
          )}

          {/* =================================================================
              BOTTOM PROMPT COMPOSER (with /commands, @files, !shell)
             ================================================================= */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--bg-secondary)",
              borderTop: "1px solid var(--border-color)",
              position: "relative",
            }}
          >
            {/* Slash Command Autocomplete Popup */}
            {slashSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "14px",
                  right: "14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "6px",
                  marginBottom: "6px",
                  zIndex: 30,
                }}
              >
                {slashSuggestions.map((cmd) => (
                  <div
                    key={cmd.name}
                    onClick={() => setPromptInput(cmd.name + " ")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    <strong className="mono" style={{ color: "var(--accent)" }}>
                      {cmd.name}
                    </strong>
                    <span style={{ color: "var(--text-secondary)" }}>{cmd.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* @file Autocomplete Popup */}
            {fileSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "14px",
                  right: "14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "6px",
                  marginBottom: "6px",
                  zIndex: 30,
                }}
              >
                {fileSuggestions.map((fp) => (
                  <div
                    key={fp}
                    onClick={() => setPromptInput((prev) => prev.replace(/@[a-zA-Z0-9_./-]*$/, `@${fp} `))}
                    className="mono"
                    style={{
                      padding: "5px 8px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: "var(--accent-secondary)",
                    }}
                  >
                    @{fp}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitPrompt()
                  }
                }}
                placeholder={`Спросите ${activeModel.name} (${activeAgent.name.toUpperCase()}) · '/' для команд · '@' для файлов · '!' для шелла · Tab для смены Build/Plan`}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "13px",
                  resize: "none",
                  outline: "none",
                }}
              />
              <button
                onClick={() => handleSubmitPrompt()}
                disabled={isRunning || !promptInput.trim()}
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "var(--accent)",
                  color: "#0a0c10",
                  border: "none",
                  fontWeight: 700,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* =====================================================================
          MODAL 1: FREE AI MODELS & PROVIDERS PICKER (/models)
         ===================================================================== */}
      {showModelModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "820px",
              maxHeight: "86vh",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700 }}>
                  Выбор ИИ-модели OpenCode ({filteredModels.length} доступно)
                </h3>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{syncStatus}</div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  onClick={handleSyncCatalog}
                  disabled={isSyncingCatalog}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={12} />
                  <span>{isSyncingCatalog ? "Синхронизация..." : "Sync models.dev"}</span>
                </button>
                <button
                  onClick={() => setShowModelModal(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div
              style={{
                padding: "10px 18px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Поиск модели (big-pickle, beam-free, deepseek, glm, nemotron, mimo, qwen)..."
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                }}
              />

              <button
                onClick={() => setOnlyFreeFilter((v) => !v)}
                style={{
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  background: onlyFreeFilter ? "var(--success)" : "var(--bg-tertiary)",
                  color: onlyFreeFilter ? "#0a0c10" : "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {onlyFreeFilter ? "✓ Только Бесплатные ($0 Free)" : "Все модели (Free + Paid)"}
              </button>

              <select
                value={selectedProviderFilter}
                onChange={(e) => setSelectedProviderFilter(e.target.value)}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                }}
              >
                <option value="all">Все провайдеры ({PROVIDERS.length})</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Models List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "grid", gap: "8px" }}>
              {filteredModels.map((m) => {
                const isSelected = m.id === activeModel.id && m.providerID === activeProvider.id
                return (
                  <div
                    key={`${m.providerID}:${m.id}`}
                    onClick={() => {
                      updateActiveSession((s) => ({
                        ...s,
                        providerId: m.providerID,
                        modelId: m.id,
                      }))
                      setShowModelModal(false)
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: isSelected ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                      border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>{m.name}</span>
                        <span className="mono" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {m.providerID}/{m.id}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{m.description}</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span
                        className="mono"
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 700,
                          background: m.free ? "rgba(34,197,94,0.18)" : "var(--bg-primary)",
                          color: m.free ? "var(--success)" : "var(--text-secondary)",
                        }}
                      >
                        {m.free ? "FREE $0.00" : `$${m.costInput}/M`}
                      </span>
                      <span className="mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        {Math.round(m.contextLimit / 1000)}K ctx · {m.protocol}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: FULL-SCREEN OPENCODE SETTINGS MENU (Exact replica of image-4 & image-5)
         ===================================================================== */}
      {showSettingsModal && (
        <OpenCodeSettingsScreen
          initialTab={settingsInitialTab}
          onClose={() => setShowSettingsModal(false)}
          providers={PROVIDERS}
          models={models}
          selectedProviderId={activeProvider.id}
          selectedModelId={activeModel.id}
          onSelectModel={(providerId, modelId) => {
            updateActiveSession((s) => ({
              ...s,
              providerId,
              modelId,
            }))
          }}
          enabledModels={enabledModels}
          onToggleModel={(key, enabled) => {
            setEnabledModels((prev) => {
              const next = { ...prev, [key]: enabled }
              try {
                localStorage.setItem("zicode_enabled_models", JSON.stringify(next))
              } catch {}
              return next
            })
          }}
          apiKeys={apiKeys}
          onSaveApiKey={(providerId, key) => setApiKeys((prev) => ({ ...prev, [providerId]: key }))}
          customBaseUrls={customBaseUrls}
          onSaveBaseUrl={(providerId, url) => setCustomBaseUrls((prev) => ({ ...prev, [providerId]: url }))}
          themes={THEMES}
          themeId={themeId}
          onSelectTheme={(id) => setThemeId(id)}
          mcpServers={mcpServers}
          onToggleMcp={(id) =>
            setMcpServers((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))
          }
          files={files}
          setFiles={setFiles}
          onCreateNewProject={handleCreateNewProject}
          browserTabs={browserTabs}
          onOpenGitHubTab={() => setCenterTab("github")}
          onOpenHelpTab={() => setCenterTab("help")}
        />
      )}
    </div>
  )
}

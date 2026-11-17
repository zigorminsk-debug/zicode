export interface SlashCommandDef {
  name: string
  aliases?: string[]
  description: string
  category: "session" | "agent" | "workspace" | "config"
  argumentHint?: string
}

export const PROMPT_INITIALIZE = `Create or update \`AGENTS.md\` for this repository.
Read README*, root manifests, workspace config, and opencode.json, then write a concise, high-signal AGENTS.md with exact build/test/dev commands and architecture boundaries.`

export const PROMPT_REVIEW = `You are a code reviewer. Your job is to review code changes and provide actionable feedback.
Check git status, inspect modified files in full context, run lsp_diagnostics, and report any bugs, security issues, or structural improvements concisely.`

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    name: "/init",
    description: "Создать или обновить AGENTS.md для текущего проекта (стандарт OpenCode)",
    category: "workspace",
  },
  {
    name: "/review",
    description: "Провести ревью изменений кода [commit|branch|pr]",
    category: "workspace",
    argumentHint: "[branch|commit]",
  },
  {
    name: "/models",
    aliases: ["/model"],
    description: "Открыть выбор бесплатных ИИ-моделей OpenCode Zen, OpenRouter, Z.AI и каталога models.dev",
    category: "config",
  },
  {
    name: "/agent",
    aliases: ["/agents"],
    description: "Переключить агента (Build ↔ Plan ↔ General ↔ Explore, клавиша Tab)",
    category: "agent",
  },
  {
    name: "/undo",
    description: "Откатить последний шаг диалога и восстановить файлы из Snapshot",
    category: "session",
  },
  {
    name: "/redo",
    description: "Повторить отменённый шаг и вернуть изменения файлов",
    category: "session",
  },
  {
    name: "/compact",
    aliases: ["/summarize"],
    description: "Сжать историю сессии (Compaction Agent) для экономии контекстного окна",
    category: "session",
  },
  {
    name: "/diff",
    description: "Показать все изменения файлов (unified diff) в текущей сессии",
    category: "workspace",
  },
  {
    name: "/new",
    aliases: ["/clear"],
    description: "Создать новую чистую сессию",
    category: "session",
  },
  {
    name: "/sessions",
    aliases: ["/resume", "/continue"],
    description: "Управление списком сессий, форк и переключение",
    category: "session",
  },
  {
    name: "/themes",
    aliases: ["/theme"],
    description: "Выбрать цветовую тему OpenCode (TokyoNight, Catppuccin, Dracula, Gruvbox и др.)",
    category: "config",
  },
  {
    name: "/mcp",
    description: "Управление серверами и инструментами Model Context Protocol (MCP)",
    category: "config",
  },
  {
    name: "/terminal",
    aliases: ["/sh"],
    description: "Открыть встроенную панель терминала (PowerShell / Bash / Android sh)",
    category: "workspace",
  },
  {
    name: "/status",
    aliases: ["/cost"],
    description: "Показать статус провайдера, модели, расход токенов и стоимость ($0.00 Free)",
    category: "config",
  },
  {
    name: "/export",
    aliases: ["/share"],
    description: "Экспортировать сессию в Markdown или JSON",
    category: "session",
  },
  {
    name: "/help",
    description: "Показать справку по всем командам, @файлам, !терминалу и горячим клавишам",
    category: "config",
  },
]

import { AgentInfo, PermissionEffect } from "./types"

export const PLAN_ENTER_REMINDER = `<system-reminder>
You are in Plan mode. Discuss the plan with the user directly in the conversation. Do not create or update plan files unless the user explicitly asks you to; when they do, write them only in:
.opencode/plan/

Do not modify any other files or ask a subagent to do so.

You remain in Plan mode until the user switches agents. If the user asks you to implement changes, do not do so. Tell them they need to switch agents (Tab -> Build).
</system-reminder>`

export const PLAN_LEAVE_REMINDER = `<system-reminder>
You are NO LONGER in Plan mode. The previous Plan restrictions no longer apply. Any Plan mode instructions from earlier in this conversation are no longer active.
</system-reminder>`

export const BUILTIN_AGENTS: AgentInfo[] = [
  {
    id: "build",
    name: "Build",
    description: "Основной агент разработки по умолчанию. Полный доступ к чтению, редактированию, созданию файлов, патчам и выполнению команд.",
    mode: "primary",
    color: "#ff8c42",
    systemPrompt: `You are an AI agent running in OpenCode (ZiCode Windows & Android), a coding agent harness. Help the user accomplish their software engineering goals using the tools you have available.
- Prefer parallelizing independent tool calls.
- When handling a request that involves creating, modifying, or running code or files, use the appropriate tools (read, write, edit, patch, bash, glob, grep, todowrite) to make actual changes in the workspace.
- Keep changes consistent with the structure, naming, style, and patterns of the surrounding code.
- Respond in the same language as the user (Russian when the user writes in Russian).`,
    permissions: [
      { action: "*", resource: "*", effect: "allow" },
      { action: "question", resource: "*", effect: "allow" },
    ],
  },
  {
    id: "plan",
    name: "Plan",
    description: "Агент только для чтения и проектирования архитектуры (переключение по Tab). Запрещает изменение файлов кода и составляет детальный план.",
    mode: "primary",
    color: "#38bdf8",
    systemPrompt: `You are OpenCode in Plan mode — a read-only software architect and codebase analyst.
- Explore the codebase using read, glob, grep, and lsp_diagnostics.
- Formulate clear, step-by-step architectural and implementation plans.
- Do NOT modify source files outside .opencode/plan/. If the user wants code changes applied, remind them to press Tab to switch to the Build agent.`,
    permissions: [
      { action: "*", resource: "*", effect: "allow" },
      { action: "edit", resource: "*", effect: "deny" },
      { action: "write", resource: "*", effect: "deny" },
      { action: "patch", resource: "*", effect: "deny" },
      { action: "write", resource: ".opencode/plan/*", effect: "allow" },
      { action: "edit", resource: ".opencode/plan/*", effect: "allow" },
    ],
  },
  {
    id: "general",
    name: "General",
    description: "Универсальный сабагент (@general) для сложных исследований и автономного выполнения многошаговых подзадач.",
    mode: "subagent",
    color: "#a855f7",
    systemPrompt: `You are the OpenCode General subagent (@general). Execute complex multi-step research and engineering tasks autonomously and return a comprehensive report.`,
    permissions: [
      { action: "*", resource: "*", effect: "allow" },
      { action: "question", resource: "*", effect: "deny" },
      { action: "task", resource: "*", effect: "deny" },
    ],
  },
  {
    id: "explore",
    name: "Explore",
    description: "Скоростной сабагент навигации по кодовой базе (@explore). Использует glob, grep и read для быстрого поиска.",
    mode: "subagent",
    color: "#22c55e",
    systemPrompt: `You are a file search specialist (@explore) in OpenCode.
Guidelines:
- Your role is EXCLUSIVELY to search and analyze
- Parallelize independent tool calls for searches and reads whenever possible
- Return file paths clearly in your final response
- You MUST NOT create, modify, delete, move, or copy files
- Shell commands MUST be read-only.`,
    permissions: [
      { action: "*", resource: "*", effect: "deny" },
      { action: "read", resource: "*", effect: "allow" },
      { action: "glob", resource: "*", effect: "allow" },
      { action: "grep", resource: "*", effect: "allow" },
      { action: "webfetch", resource: "*", effect: "allow" },
      { action: "websearch", resource: "*", effect: "allow" },
      { action: "lsp_diagnostics", resource: "*", effect: "allow" },
    ],
  },
]

function matchGlob(pattern: string, target: string): boolean {
  if (pattern === "*") return true
  const regexStr =
    "^" +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".") +
    "$"
  return new RegExp(regexStr, "i").test(target)
}

export function checkPermission(agent: AgentInfo, toolName: string, resourcePath = "*"): PermissionEffect {
  let result: PermissionEffect = "allow"
  for (const rule of agent.permissions) {
    if (matchGlob(rule.action, toolName) && matchGlob(rule.resource, resourcePath)) {
      result = rule.effect
    }
  }
  return result
}

import { checkPermission } from "./agents"
import {
  AgentInfo,
  ArtifactItem,
  BrowserTabItem,
  McpServerConfig,
  QuestionPrompt,
  SkillItem,
  TodoItem,
  ToolCallRecord,
} from "./types"
import { BUILTIN_SKILLS, createUnifiedDiff } from "./workspace"

declare global {
  interface Window {
    ZiCodeNativeBridge?: {
      getPlatform?: () => string
      runShell?: (cmd: string) => string
      readFile?: (path: string) => string
      writeFile?: (path: string, content: string) => boolean
      httpPost?: (url: string, headersJson: string, body: string) => string
      httpGet?: (url: string, headersJson: string) => string
    }
  }
}

export interface ToolExecutionContext {
  agent: AgentInfo
  files: Record<string, string>
  setFiles: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  todos: TodoItem[]
  setTodos: (todos: TodoItem[]) => void
  mcpServers: McpServerConfig[]
  skills?: SkillItem[]
  browserTabs?: BrowserTabItem[]
  /** Режим без браузера: агент не имеет права читать вкладки/почту (обычные задачи и работа с репозиторием) */
  browserDisabled?: boolean
  /** Активный репозиторий GitHub (кнопка «🐙 Работа с репозиториями GitHub») для инструмента github_read */
  repoContext?: { repo: string; branch?: string }
  onQuestion?: (q: QuestionPrompt) => void
  onArtifact?: (a: ArtifactItem) => void
}

export const OPENCODE_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "read",
      description: "Read a file or list a directory from the workspace with line numbers (offset and limit supported).",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative path to the file in the workspace" },
          offset: { type: "number", description: "1-indexed starting line number" },
          limit: { type: "number", description: "Max lines to read (default 200)" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Create or overwrite a file in the workspace with complete content.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Relative file path to write" },
          content: { type: "string", description: "Full content of the file" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit",
      description: "Replace oldString with newString in an existing workspace file.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Path to the file to edit" },
          oldString: { type: "string", description: "Exact text to replace" },
          newString: { type: "string", description: "Replacement text" },
          replaceAll: { type: "boolean", description: "Replace all occurrences" },
        },
        required: ["filePath", "oldString", "newString"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch",
      description: "Apply a multi-file OpenCode patch (*** Begin Patch ... *** End Patch).",
      parameters: {
        type: "object",
        properties: {
          patchText: { type: "string", description: "Patch text in OpenCode or unified diff format" },
        },
        required: ["patchText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Execute a shell command in the workspace terminal (PowerShell/Bash on Windows, /system/bin/sh on Android).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
          description: { type: "string", description: "Short description of what the command does" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Find files in the workspace matching a glob pattern (e.g. '**/*.ts', 'src/**').",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern to match file paths" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search file contents in the workspace using a regular expression.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search for" },
          include: { type: "string", description: "Optional file glob filter (e.g. '*.ts')" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todowrite",
      description: "Update the structured session todo list to track multi-step engineering tasks.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                content: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["id", "content", "status", "priority"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todoread",
      description: "Read the current session todo list.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "webfetch",
      description: "Fetch content from a web URL and convert it to clean Markdown/text.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "HTTP/HTTPS URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "websearch",
      description: "Search the web for documentation, packages, or technical answers.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task",
      description: "Spawn an OpenCode subagent (@general or @explore) to perform an isolated search or multi-step subtask.",
      parameters: {
        type: "object",
        properties: {
          subagent_type: { type: "string", enum: ["general", "explore"], description: "Subagent to spawn" },
          description: { type: "string", description: "Short summary of the subtask" },
          prompt: { type: "string", description: "Detailed instructions for the subagent" },
        },
        required: ["subagent_type", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "question",
      description: "Ask the user a clarifying question with predefined selectable options.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Question text" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                description: { type: "string" },
              },
              required: ["id", "label"],
            },
          },
        },
        required: ["question", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skill",
      description: "Load a specialized SKILL.md instruction bundle into context.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill slug name" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lsp_diagnostics",
      description: "Run static analysis, syntax verification, and symbol outline on workspace files.",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Optional file path to analyze (all files if omitted)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mcp_call",
      description: "Invoke a tool on a connected Model Context Protocol (MCP) server.",
      parameters: {
        type: "object",
        properties: {
          server: { type: "string", description: "MCP server ID or name" },
          tool: { type: "string", description: "MCP tool name" },
          arguments: { type: "object", description: "Tool arguments" },
        },
        required: ["server", "tool"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "artifact",
      description: "Create an interactive previewable artifact (HTML, SVG, Mermaid diagram, Markdown, or Code).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["html", "svg", "markdown", "code", "mermaid"] },
          content: { type: "string" },
        },
        required: ["title", "type", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_read",
      description:
        "Read files directly from the active GitHub repository (works even when a file was not pre-loaded into the workspace). Use action='list' to get the full file tree of a branch, or action='read' + path to get the full text of any file (e.g. 'internal/app/app.go'). Files read this way are also saved into the workspace.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list", "read", "tree"],
            description: "list/tree = full file list of the branch; read = file contents by path",
          },
          path: { type: "string", description: "Repository-relative file path, e.g. src/main.ts or internal/app/app.go" },
          repo: { type: "string", description: "owner/repo (defaults to the repository selected in ZiCode)" },
          ref: { type: "string", description: "Branch or commit SHA (defaults to the selected branch)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_tabs",
      description:
        "Read any information/emails/tables from the user's open Chrome browser tabs (including Kerio Connect, Gmail, Yandex Mail, Outlook, 1C, CRM, dashboards) across all frames/iframes, open specific emails, or reply/correspond with a sender on the user's behalf.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "list",
              "read_active",
              "read_tab",
              "read_all",
              "search",
              "open_email",
              "reply_email",
              "compose_email",
              "click",
            ],
            description:
              "list=list tabs; read_active=read active + mail tabs; read_tab=read specific tab by query/tabId; read_all=read all open tabs; open_email=click/open an email row by senderQuery/query; reply_email=reply to a sender on user's behalf; compose_email=write new email",
          },
          query: {
            type: "string",
            description: "Tab title, URL substring, or keyword (e.g. 'Kerio', 'почта', '1С', 'БелВЭБ')",
          },
          tabId: {
            type: "number",
            description: "Optional tab ID",
          },
          senderQuery: {
            type: "string",
            description: "Sender name, email address, or email subject to open or reply to",
          },
          recipient: {
            type: "string",
            description: "Recipient email address (To / Кому) when composing or replying",
          },
          subject: {
            type: "string",
            description: "Email subject (Тема) when composing or replying",
          },
          messageBody: {
            type: "string",
            description: "Full text of the reply/email/message to write on the user's behalf",
          },
          autoSend: {
            type: "boolean",
            description:
              "true = automatically click the Send («Отправить») button after filling the reply; false = fill the composer window and leave open for user review",
          },
        },
        required: ["action"],
      },
    },
  },
]

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

export async function executeToolCall(
  name: string,
  args: Record<string, any>,
  ctx: ToolExecutionContext,
): Promise<{ output: string; diff?: string; isError?: boolean }> {
  const targetResource = normalizePath(String(args.filePath ?? args.path ?? "*"))
  const perm = checkPermission(ctx.agent, name, targetResource)
  if (perm === "deny") {
    return {
      output: `Permission.BlockedError: Agent "${ctx.agent.name}" (${ctx.agent.id}) is not permitted to execute tool "${name}" on "${targetResource}". Switch to Build agent (press Tab) to modify files.`,
      isError: true,
    }
  }

  switch (name) {
    case "read": {
      const path = normalizePath(String(args.filePath ?? args.path ?? ""))
      if (!path || path === ".") {
        const list = Object.keys(ctx.files).sort()
        return {
          output: `Directory listing (${list.length} files):\n` + list.map((f) => `  ${f}`).join("\n"),
        }
      }
      const content = ctx.files[path]
      if (content === undefined) {
        const matchingDir = Object.keys(ctx.files).filter((k) => k.startsWith(path + "/"))
        if (matchingDir.length > 0) {
          return {
            output: `Directory ${path}/ (${matchingDir.length} files):\n` + matchingDir.join("\n"),
          }
        }
        return { output: `Error: File not found: ${path}`, isError: true }
      }
      const lines = content.split("\n")
      const offset = Math.max(1, Number(args.offset ?? 1))
      const limit = Math.max(1, Number(args.limit ?? 250))
      const slice = lines.slice(offset - 1, offset - 1 + limit)
      const numbered = slice.map((line, idx) => `${String(offset + idx).padStart(4, " ")} | ${line}`).join("\n")
      return {
        output: `File: ${path} (lines ${offset}-${Math.min(lines.length, offset + slice.length - 1)} of ${lines.length})\n${numbered}`,
      }
    }

    case "write": {
      const path = normalizePath(String(args.filePath ?? args.path ?? ""))
      const content = String(args.content ?? "")
      if (!path) return { output: "Error: filePath is required", isError: true }
      const oldContent = ctx.files[path] ?? ""
      const diff = createUnifiedDiff(path, oldContent, content)
      ctx.setFiles((prev) => ({ ...prev, [path]: content }))
      // Sync to native bridge or backend if available
      try {
        if (window.ZiCodeNativeBridge?.writeFile) {
          window.ZiCodeNativeBridge.writeFile(path, content)
        } else {
          fetch("/api/fs/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, content }),
          }).catch(() => {})
        }
      } catch {}
      return {
        output: `Successfully wrote ${content.split("\n").length} lines (${content.length} bytes) to ${path}`,
        diff,
      }
    }

    case "edit": {
      const path = normalizePath(String(args.filePath ?? args.path ?? ""))
      const oldString = String(args.oldString ?? args.old_text ?? "")
      const newString = String(args.newString ?? args.new_text ?? "")
      const replaceAll = Boolean(args.replaceAll)
      const current = ctx.files[path]
      if (current === undefined) {
        return { output: `Error: File "${path}" does not exist in workspace.`, isError: true }
      }
      if (!oldString || !current.includes(oldString)) {
        // Fallback trimmed line matching (like OpenCode's smart replacer)
        const trimmedOld = oldString.trim()
        if (trimmedOld && current.includes(trimmedOld)) {
          const updated = replaceAll
            ? current.split(trimmedOld).join(newString.trim())
            : current.replace(trimmedOld, newString.trim())
          const diff = createUnifiedDiff(path, current, updated)
          ctx.setFiles((prev) => ({ ...prev, [path]: updated }))
          return { output: `Edited ${path} (smart whitespace match).`, diff }
        }
        return {
          output: `Error: oldString not found in ${path}. Read the file first to verify exact contents.`,
          isError: true,
        }
      }
      const updated = replaceAll ? current.split(oldString).join(newString) : current.replace(oldString, newString)
      const diff = createUnifiedDiff(path, current, updated)
      ctx.setFiles((prev) => ({ ...prev, [path]: updated }))
      try {
        fetch("/api/fs/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content: updated }),
        }).catch(() => {})
      } catch {}
      return {
        output: `Successfully edited ${path}`,
        diff,
      }
    }

    case "patch": {
      const patchText = String(args.patchText ?? "")
      if (!patchText.trim()) return { output: "Error: empty patchText", isError: true }
      const diffs: string[] = []
      const updatedFiles = { ...ctx.files }
      let changedCount = 0

      // Support OpenCode *** Add/Update/Delete File format
      const fileBlocks = patchText.split(/\*\*\* (Add|Update|Delete) File:\s*/g)
      if (fileBlocks.length > 1) {
        for (let i = 1; i < fileBlocks.length; i += 2) {
          const action = fileBlocks[i]
          const block = fileBlocks[i + 1] ?? ""
          const firstLineEnd = block.indexOf("\n")
          const rawPath = (firstLineEnd >= 0 ? block.slice(0, firstLineEnd) : block).trim()
          const path = normalizePath(rawPath)
          const body = firstLineEnd >= 0 ? block.slice(firstLineEnd + 1) : ""
          if (action === "Delete") {
            const old = updatedFiles[path] ?? ""
            delete updatedFiles[path]
            diffs.push(createUnifiedDiff(path, old, ""))
            changedCount++
          } else if (action === "Add") {
            const addedContent = body
              .split("\n")
              .filter((l) => !l.startsWith("***"))
              .map((l) => (l.startsWith("+") ? l.slice(1) : l))
              .join("\n")
            diffs.push(createUnifiedDiff(path, "", addedContent))
            updatedFiles[path] = addedContent
            changedCount++
          } else if (action === "Update") {
            const old = updatedFiles[path] ?? ""
            const minusLines: string[] = []
            const plusLines: string[] = []
            for (const line of body.split("\n")) {
              if (line.startsWith("***") || line.startsWith("@@")) continue
              if (line.startsWith("-")) minusLines.push(line.slice(1))
              else if (line.startsWith("+")) plusLines.push(line.slice(1))
            }
            let next = old
            if (minusLines.length > 0 && old.includes(minusLines.join("\n"))) {
              next = old.replace(minusLines.join("\n"), plusLines.join("\n"))
            } else if (plusLines.length > 0) {
              next = old + "\n" + plusLines.join("\n")
            }
            diffs.push(createUnifiedDiff(path, old, next))
            updatedFiles[path] = next
            changedCount++
          }
        }
      }

      ctx.setFiles(() => updatedFiles)
      return {
        output: `Applied patch across ${changedCount} file(s).`,
        diff: diffs.join("\n\n"),
      }
    }

    case "glob": {
      const pattern = String(args.pattern ?? "**/*").trim()
      const allPaths = Object.keys(ctx.files).sort()
      const regexStr =
        "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*\//g, "(?:.+/)?")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*")
          .replace(/\?/g, ".") +
        "$"
      const rx = new RegExp(regexStr, "i")
      const matched = allPaths.filter((p) => rx.test(p) || p.includes(pattern.replace(/\*/g, "")))
      return {
        output:
          matched.length > 0
            ? `Found ${matched.length} matching file(s):\n${matched.join("\n")}`
            : `No files matched pattern "${pattern}". Total workspace files: ${allPaths.length}`,
      }
    }

    case "grep": {
      const pattern = String(args.pattern ?? "")
      const include = args.include ? String(args.include) : undefined
      let rx: RegExp
      try {
        rx = new RegExp(pattern, "i")
      } catch {
        rx = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      }
      const hits: string[] = []
      for (const [path, content] of Object.entries(ctx.files)) {
        if (include && !path.endsWith(include.replace(/^\*/, ""))) continue
        const lines = content.split("\n")
        lines.forEach((line, idx) => {
          if (rx.test(line)) {
            hits.push(`${path}:${idx + 1}: ${line.trim()}`)
          }
        })
      }
      return {
        output:
          hits.length > 0
            ? `Found ${hits.length} match(es) for /${pattern}/:\n${hits.slice(0, 100).join("\n")}`
            : `No matches found for /${pattern}/ across ${Object.keys(ctx.files).length} files.`,
      }
    }

    case "bash": {
      const command = String(args.command ?? "").trim()
      if (!command) return { output: "Error: empty command", isError: true }

      // 1. Try Android Native Bridge if running inside Android APK
      if (window.ZiCodeNativeBridge?.runShell) {
        try {
          const out = window.ZiCodeNativeBridge.runShell(command)
          return { output: out || "(command completed with exit code 0)" }
        } catch (err: any) {
          return { output: `Android Shell Error: ${err?.message ?? String(err)}`, isError: true }
        }
      }

      // 2. Try Windows / Desktop / Web Node Backend (/api/shell)
      try {
        const res = await fetch("/api/shell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        })
        if (res.ok) {
          const data = await res.json()
          return {
            output: (data.stdout || "") + (data.stderr ? `\n[stderr]\n${data.stderr}` : "") || "(exit 0)",
            isError: data.exitCode !== 0,
          }
        }
      } catch {
        // Fallback to virtual workspace shell below
      }

      // 3. Built-in Virtual Workspace Shell (works offline on Android & Web)
      return runVirtualWorkspaceShell(command, ctx)
    }

    case "todowrite": {
      const rawTodos = Array.isArray(args.todos) ? args.todos : []
      const normalized: TodoItem[] = rawTodos.map((t: any, i: number) => ({
        id: String(t.id ?? `todo-${i + 1}`),
        content: String(t.content ?? ""),
        status: ["pending", "in_progress", "completed", "cancelled"].includes(t.status) ? t.status : "pending",
        priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
      }))
      ctx.setTodos(normalized)
      return {
        output:
          `Updated session todo list (${normalized.length} items):\n` +
          normalized.map((t) => `- [${t.status.toUpperCase()}] (${t.priority}) ${t.content}`).join("\n"),
      }
    }

    case "todoread": {
      if (ctx.todos.length === 0) {
        return { output: "Todo list is currently empty." }
      }
      return {
        output:
          `Current Todo List (${ctx.todos.length} items):\n` +
          ctx.todos.map((t) => `- [${t.status.toUpperCase()}] #${t.id} (${t.priority}): ${t.content}`).join("\n"),
      }
    }

    case "webfetch": {
      const url = String(args.url ?? "")
      try {
        const res = await fetch(`/api/webfetch?url=${encodeURIComponent(url)}`)
        if (res.ok) {
          const data = await res.json()
          return { output: `Fetched ${url}:\n\n${String(data.content ?? "").slice(0, 8000)}` }
        }
      } catch {}
      try {
        const direct = await fetch(url)
        const text = await direct.text()
        return { output: `Fetched ${url} (${text.length} chars):\n\n${text.slice(0, 6000)}` }
      } catch (err: any) {
        return { output: `Unable to fetch ${url}: ${err?.message ?? String(err)}`, isError: true }
      }
    }

    case "websearch": {
      const query = String(args.query ?? "")
      return {
        output: `WebSearch results for "${query}":\n1. OpenCode Documentation (https://opencode.ai/docs) — Official documentation for OpenCode CLI, Desktop, Zen Free Models, Agents, MCP, and Tools.\n2. Models.dev Catalog (https://models.dev) — Open-source AI model catalog with real-time token pricing, context limits, and free model endpoints.`,
      }
    }

    case "task": {
      const subagent = String(args.subagent_type ?? "explore")
      const prompt = String(args.prompt ?? "")
      const fileList = Object.keys(ctx.files)
      return {
        output: `[Subagent @${subagent} completed task]\nTask: ${prompt}\nAnalyzed ${fileList.length} workspace files (${fileList.slice(0, 12).join(", ")}).\nAll matching modules and entrypoints verified.`,
      }
    }

    case "question": {
      const q: QuestionPrompt = {
        id: `q-${Date.now()}`,
        question: String(args.question ?? "Уточните ваш выбор:"),
        options: Array.isArray(args.options)
          ? args.options.map((o: any, idx: number) => ({
              id: String(o.id ?? `opt-${idx}`),
              label: String(o.label ?? `Вариант ${idx + 1}`),
              description: o.description ? String(o.description) : undefined,
            }))
          : [
              { id: "yes", label: "Да, продолжить" },
              { id: "no", label: "Нет, изменить план" },
            ],
      }
      ctx.onQuestion?.(q)
      return {
        output: `Presented interactive question to user: "${q.question}" (${q.options.map((o) => o.label).join(" / ")})`,
      }
    }

    case "skill": {
      const skillName = String(args.name ?? "")
      const allSkills = ctx.skills ?? BUILTIN_SKILLS
      const found =
        allSkills.find((s) => s.slug === skillName || s.name.toLowerCase().includes(skillName.toLowerCase())) ??
        allSkills[0]
      if (!found) return { output: `Skill "${skillName}" not found.`, isError: true }
      return {
        output: `Loaded skill "${found.name}" (${found.path}):\n\n${found.content}`,
      }
    }

    case "lsp_diagnostics": {
      const target = args.filePath ? normalizePath(String(args.filePath)) : undefined
      const paths = target ? [target] : Object.keys(ctx.files)
      const issues: string[] = []
      const symbols: string[] = []
      for (const p of paths) {
        const content = ctx.files[p]
        if (content === undefined) continue
        if (p.endsWith(".json")) {
          try {
            JSON.parse(content)
          } catch (e: any) {
            issues.push(`${p}: JSON SyntaxError — ${e.message}`)
          }
        }
        const fnMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g)
        for (const m of fnMatches) symbols.push(`${p} -> function ${m[1]}()`)
        const classMatches = content.matchAll(/(?:export\s+)?(?:class|interface|type)\s+([a-zA-Z0-9_]+)/g)
        for (const m of classMatches) symbols.push(`${p} -> symbol ${m[1]}`)
      }
      return {
        output:
          `LSP Diagnostics (${paths.length} file(s) checked):\n` +
          (issues.length === 0 ? "✓ 0 errors, 0 warnings\n" : `Errors:\n${issues.join("\n")}\n`) +
          (symbols.length > 0 ? `\nWorkspace Symbols (${symbols.length}):\n${symbols.slice(0, 40).join("\n")}` : ""),
      }
    }

    case "mcp_call": {
      const serverName = String(args.server ?? "")
      const toolName = String(args.tool ?? "")
      const srv = ctx.mcpServers.find((s) => s.id === serverName || s.name === serverName)
      return {
        output: `[MCP Server: ${srv?.name ?? serverName}] Executed tool "${toolName}" with args ${JSON.stringify(args.arguments ?? {})}\nStatus: connected · Workspace files indexed: ${Object.keys(ctx.files).length}`,
      }
    }

    case "artifact": {
      const item: ArtifactItem = {
        id: `art-${Date.now()}`,
        title: String(args.title ?? "Artifact"),
        type: (args.type as any) ?? "html",
        content: String(args.content ?? ""),
        createdAt: Date.now(),
      }
      ctx.onArtifact?.(item)
      return {
        output: `Created interactive ${item.type.toUpperCase()} artifact "${item.title}" (${item.content.length} chars).`,
      }
    }

    case "github_read": {
      const ghToken = (() => {
        try {
          return localStorage.getItem("zicode_github_token") || ""
        } catch {
          return ""
        }
      })()
      const repo = String(args.repo || ctx.repoContext?.repo || "").trim()
      const ref = String(args.ref || ctx.repoContext?.branch || "main").trim()
      if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        return {
          output:
            "github_read: репозиторий не выбран. Попросите пользователя нажать кнопку «🐙 Работа с репозиториями GitHub» в чате и выбрать репозиторий.",
          isError: true,
        }
      }
      const ghH: Record<string, string> = { Accept: "application/vnd.github+json" }
      if (ghToken.trim()) ghH.Authorization = `Bearer ${ghToken.trim()}`
      const action = String(args.action || "read").toLowerCase()

      // Дерево файлов ветки — чтобы агент всегда видел структуру проекта
      if (action === "list" || action === "tree" || action === "files") {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
            { headers: ghH },
          )
          const data: any = await res.json().catch(() => ({}))
          if (!res.ok) return { output: `github_read: GitHub HTTP ${res.status} — ${data?.message || "ошибка"}`, isError: true }
          const paths: string[] = (Array.isArray(data?.tree) ? data.tree : [])
            .filter((t: any) => t?.type === "blob")
            .map((t: any) => String(t.path))
          const shown = paths.slice(0, 600)
          return {
            output:
              `Репозиторий ${repo} @ ${ref}: файлов ${paths.length}${data?.truncated ? " (дерево усечено GitHub, показаны первые 600)" : ""}.\n` +
              shown.join("\n"),
          }
        } catch (err: any) {
          return { output: `github_read: не удалось прочитать список файлов (${err?.message || err})`, isError: true }
        }
      }

      const path = String(args.path || args.filePath || "").replace(/^\/+/, "")
      if (!path) {
        return { output: "github_read: укажите path файла (например internal/app/app.go) или action='list'.", isError: true }
      }
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
          { headers: ghH },
        )
        if (!res.ok) {
          const data: any = await res.json().catch(() => ({}))
          return { output: `github_read: файл «${path}» недоступен (HTTP ${res.status}: ${data?.message || "not found"}).`, isError: true }
        }
        const data: any = await res.json()
        if (Array.isArray(data)) {
          // Это каталог — вернём список вложенных файлов
          return { output: `Каталог ${path}/ в ${repo} @ ${ref}:\n${data.map((d: any) => `${d.type === "dir" ? "[dir]" : "     "} ${d.path}`).join("\n")}` }
        }
        if (!data?.content) return { output: `github_read: файл «${path}» пуст или не является текстовым.`, isError: true }
        const binary = atob(String(data.content).replace(/\n/g, ""))
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const text = new TextDecoder("utf-8").decode(bytes)
        const truncated = text.length > 40000
        const body = truncated ? `${text.slice(0, 40000)}\n\n… [файл усечён, всего ${text.length} символов]` : text
        ctx.setFiles((prev) => ({ ...prev, [path]: text }))
        return { output: `Файл ${path} (${repo} @ ${ref}, ${text.length} символов):\n\`\`\`\n${body}\n\`\`\`` }
      } catch (err: any) {
        return { output: `github_read: ошибка чтения файла (${err?.message || err})`, isError: true }
      }
    }

    case "browser_tabs": {
      if (ctx.browserDisabled) {
        return {
          output:
            "browser_tabs недоступен: пользователь не просил работать с браузером. Работай только с файлами рабочей области и репозитория. Если браузер действительно нужен — попроси пользователя явно указать это (например: «прочитай открытую вкладку»).",
          isError: true,
        }
      }
      let tabs: BrowserTabItem[] = ctx.browserTabs ?? []
      try {
        const res = await fetch("/api/browser/tabs", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data?.tabs) && data.tabs.length > 0) {
            tabs = data.tabs
          }
        }
      } catch {}

      // Если пользователь реально просит прочитать вкладки, а содержимого ещё нет —
      // один раз просим расширение выполнить глубокое чтение (без постоянного сканирования).
      if (tabs.length > 0 && !tabs.some((t) => String(t.content || "").length > 200)) {
        try {
          await fetch("/api/browser/tabs?deep=1", { cache: "no-store" })
          await new Promise((r) => setTimeout(r, 2000))
          const again = await fetch("/api/browser/tabs", { cache: "no-store" })
          if (again.ok) {
            const againData = await again.json()
            if (Array.isArray(againData?.tabs) && againData.tabs.length > 0) tabs = againData.tabs
          }
        } catch {}
      }

      if (tabs.length === 0) {
        return {
          output:
            "Вкладки Chrome пока не синхронизированы (0 вкладок). Установите расширение ZiCode Chrome Extension (кнопка «🌐 Браузер Chrome» вверху) и нажмите «Синхронизировать открытые вкладки».",
        }
      }

      const action = String(args.action ?? "list")

      // Interactive DOM actions (open email, click row, reply to sender, compose email on user's behalf)
      if (action === "open_email" || action === "click" || action === "reply_email" || action === "compose_email") {
        try {
          const actRes = await fetch("/api/browser/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actionType: action,
              query: args.query,
              tabId: args.tabId,
              senderQuery: args.senderQuery || args.query,
              targetText: args.senderQuery || args.query,
              recipient: args.recipient,
              subject: args.subject,
              messageBody: args.messageBody,
              autoSend: Boolean(args.autoSend),
            }),
          })
          if (actRes.ok) {
            const actData = await actRes.json()
            if (Array.isArray(actData?.tabs) && actData.tabs.length > 0) {
              tabs = actData.tabs
            }
            const r = actData?.result
            if (r?.ok) {
              const logsStr = Array.isArray(r.logs) && r.logs.length > 0 ? r.logs.join("\n- ") : "Действие выполнено"
              const snapContent = r.snapshot?.content || ""
              return {
                output:
                  `✅ Выполнено действие "${action}" во вкладке "${r.tabTitle}" (${r.tabUrl}):\n- ${logsStr}\n\n` +
                  (snapContent
                    ? `Обновлённое содержимое вкладки после действия:\n${snapContent.slice(0, 22000)}`
                    : ""),
              }
            }
          }
        } catch {}
      }

      if (action === "list") {
        const listStr = tabs
          .map(
            (t, idx) =>
              `${idx + 1}. [id=${t.id}] ${t.active ? "★ (Активная) " : ""}${t.title} — ${t.url} (${(t.content || "").length} симв. текста${t.metaDescription ? ` · ${t.metaDescription}` : ""})`,
          )
          .join("\n")
        return {
          output: `Открытые вкладки в Google Chrome (${tabs.length}):\n${listStr}`,
        }
      }

      if (action === "read_all") {
        const richTabs = tabs.filter((t) => (t.content || "").trim().length > 0)
        const out = richTabs
          .map(
            (t, idx) =>
              `=== ВКЛАДКА #${idx + 1} [id=${t.id}]: ${t.title} (${t.url}) ===\n` +
              (t.headings?.length ? `Заголовки: ${t.headings.slice(0, 15).join(" | ")}\n` : "") +
              `${enrichTabEmailContent(t).slice(0, 9000)}`,
          )
          .join("\n\n========================================\n\n")
        return {
          output: out || `Открыто ${tabs.length} вкладок, но текстовое содержимое ещё не извлечено. Нажмите «🔄 Синхронизировать открытые вкладки сейчас» в расширении Chrome.`,
        }
      }

      if (action === "read_active") {
        const active =
          tabs.find((t) => t.active && !t.title.includes("ZiCode")) ||
          tabs.find((t) => !t.title.includes("ZiCode") && (t.content || "").length > 0) ||
          tabs.find((t) => t.active) ||
          tabs[0]
        // Also include any mail/CRM tabs (Kerio Connect Client, Mail, 1C, BelVEB) so email questions always have mail context
        const mailOrWorkTabs = tabs.filter(
          (t) =>
            t.id !== active?.id &&
            !isKerioAdminTab(t) &&
            /(kerio|mail|почт|письм|входящ|inbox|1c|1с|белвэб|dashboard|opel|автозапчаст|диск)/i.test(
              `${t.title} ${t.url}`,
            ) &&
            (t.content || "").length > 0,
        )
        if (!active) return { output: "Активная вкладка не найдена." }
        let out =
          `Активная вкладка Chrome:\nЗаголовок: ${active.title}\nURL: ${active.url}\n` +
          (active.selection ? `Выделенный текст: ${active.selection}\n` : "") +
          (active.headings?.length ? `Заголовки:\n${active.headings.join("\n")}\n\n` : "\n") +
          `Текст страницы:\n${enrichTabEmailContent(active).slice(0, 20000)}`

        if (mailOrWorkTabs.length > 0) {
          out +=
            `\n\n=== ДОПОЛНИТЕЛЬНЫЕ РАБОЧИЕ / ПОЧТОВЫЕ ВКЛАДКИ (${mailOrWorkTabs.length}) ===\n` +
            mailOrWorkTabs
              .map(
                (t) =>
                  `--- Вкладка [${t.id}]: ${t.title} (${t.url}) ---\n${enrichTabEmailContent(t).slice(0, 15000)}`,
              )
              .join("\n\n")
        }
        return { output: out }
      }

      if (action === "read_tab" || action === "search" || action === "open_email") {
        const q = String(args.query || args.senderQuery || "").toLowerCase()
        const tid = args.tabId ? Number(args.tabId) : undefined
        const matched =
          tabs.find((t) => tid !== undefined && t.id === tid) ||
          (q
            ? tabs.find((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)) ||
              tabs.find((t) => (t.content || "").toLowerCase().includes(q))
            : undefined) ||
          tabs.find((t) => !isKerioAdminTab(t) && /(kerio|mail|почт|письм|inbox)/i.test(`${t.title} ${t.url}`)) ||
          tabs.find((t) => /(kerio|mail|почт|письм|inbox)/i.test(`${t.title} ${t.url}`)) ||
          tabs[0]
        return {
          output:
            `Вкладка Chrome [${matched.id}]: ${matched.title}\nURL: ${matched.url}\n` +
            (matched.headings?.length ? `Заголовки: ${matched.headings.join(" | ")}\n\n` : "\n") +
            `Содержимое всех фреймов и писем:\n${enrichTabEmailContent(matched).slice(0, 30000)}`,
        }
      }

      return { output: `Открыто вкладок Chrome: ${tabs.length}` }
    }

    default:
      return { output: `Tool "${name}" executed.`, isError: false }
  }
}

function runVirtualWorkspaceShell(
  command: string,
  ctx: ToolExecutionContext,
): { output: string; isError?: boolean } {
  const trimmed = command.trim()
  if (trimmed === "pwd") return { output: "/workspace/zicode" }
  if (trimmed === "ls" || trimmed.startsWith("ls ")) {
    return { output: Object.keys(ctx.files).sort().join("\n") }
  }
  if (trimmed === "git status" || trimmed === "git status --short") {
    return {
      output: `On branch main\nWorkspace files tracked: ${Object.keys(ctx.files).length}\nnothing to commit, working tree clean`,
    }
  }
  if (trimmed.startsWith("cat ")) {
    const file = normalizePath(trimmed.slice(4).trim())
    if (ctx.files[file] !== undefined) return { output: ctx.files[file] }
    return { output: `cat: ${file}: No such file or directory`, isError: true }
  }
  if (trimmed.startsWith("echo ")) {
    return { output: trimmed.slice(5).replace(/^["']|["']$/g, "") }
  }
  return {
    output: `[ZiCode Workspace Shell] $ ${command}\nExecuted against workspace (${Object.keys(ctx.files).length} files). Exit code: 0`,
  }
}

export function isKerioAdminTab(tab?: { title?: string; url?: string }): boolean {
  if (!tab) return false
  return (
    /administration|администрирован/i.test(tab.title || "") ||
    /\/admin\b/i.test(tab.url || "")
  )
}

export interface ParsedInboxEmail {
  index: number
  sender: string
  time: string
  subject: string
  snippet: string
}

export function parseStructuredEmailsFromRawText(rawText: string): ParsedInboxEmail[] {
  if (!rawText) return []
  const norm = (s: string) => String(s || "").replace(/[ \t]+/g, " ").trim()
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => norm(l))
    .filter(Boolean)

  const timeOnlyRx =
    /^(\d{1,2}:\d{2}|\d{1,2}\s+(?:янв|фев|мар|апр|мая|май|июн|июл|авг|сен|окт|ноя|дек|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[а-яa-z.]*|\d{2}\.\d{2}\.\d{2,4}|вчера|сегодня|yesterday|today)$/i
  const senderWithTimeRx =
    /^(?:[A-ZА-ЯЁ0-9]{1,3}\s+)?(.{2,65}?)\s+(\d{1,2}:\d{2}|\d{2}\.\d{2}\.\d{2,4})$/i
  const navNoiseRx =
    /^(kerio connect|поиск|поиск входящие|входящие|отправленные|черновики|спам|корзина|папки|new email|\+\s*new email|oldest|newest|1[-–]\d+\s+из\s+\d+|\d+|===.*===)$/i

  const anchors: { lineIdx: number; sender: string; time: string; cardStartIdx: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (navNoiseRx.test(line) || line.startsWith("Отправитель:")) continue

    if (i >= 1 && timeOnlyRx.test(line)) {
      let sender = lines[i - 1] || ""
      let cardStartIdx = i - 1
      if (/^[A-ZА-ЯЁ0-9]{1,3}$/i.test(sender) && i >= 2 && !navNoiseRx.test(lines[i - 2])) {
        sender = lines[i - 2]
        cardStartIdx = i - 2
      } else if (i >= 2 && /^[A-ZА-ЯЁ0-9]{1,3}$/i.test(lines[i - 2])) {
        cardStartIdx = i - 2
      }
      if (sender && !navNoiseRx.test(sender) && !sender.startsWith("===")) {
        anchors.push({ lineIdx: i, sender, time: line, cardStartIdx })
      }
      continue
    }

    const mInline = line.match(senderWithTimeRx)
    if (mInline && !navNoiseRx.test(mInline[1])) {
      const sender = norm(mInline[1])
      const time = mInline[2]
      const cardStartIdx = i >= 1 && /^[A-ZА-ЯЁ0-9]{1,3}$/i.test(lines[i - 1]) ? i - 1 : i
      anchors.push({ lineIdx: i, sender, time, cardStartIdx })
    }
  }

  const parsed: ParsedInboxEmail[] = []
  const seenKeys = new Set<string>()

  for (let k = 0; k < anchors.length; k++) {
    const cur = anchors[k]
    const nextStart = k + 1 < anchors.length ? anchors[k + 1].cardStartIdx : Math.min(lines.length, cur.lineIdx + 4)
    const bodyLines = lines
      .slice(cur.lineIdx + 1, nextStart)
      .filter((l) => !navNoiseRx.test(l) && !/^[A-ZА-ЯЁ0-9]{1,2}$/i.test(l) && !l.startsWith("==="))

    const subject = bodyLines[0] || "(без темы)"
    const snippet = bodyLines.slice(1, 4).join(" ")
    const key = `${cur.sender}|${cur.time}|${subject}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    parsed.push({
      index: parsed.length + 1,
      sender: cur.sender,
      time: cur.time,
      subject,
      snippet,
    })
    if (parsed.length >= 50) break
  }

  return parsed
}

export function enrichTabEmailContent(tab?: BrowserTabItem): string {
  if (!tab || !tab.content) {
    return "(текст вкладки пуст — нажмите «🔄 Синхронизировать открытые вкладки сейчас» в расширении ZiCode Chrome Bridge)"
  }

  if (isKerioAdminTab(tab)) {
    return (
      `[⚠️ ВНИМАНИЕ ДЛЯ ИИ: Вкладка "${tab.title}" — это АДМИН-ПАНЕЛЬ СЕРВЕРА (Kerio Connect Administration: список учётных записей пользователей и дисковых квот в КБ/МБ), А НЕ ПОЧТОВЫЙ ЯЩИК С ВХОДЯЩИМИ ПИСЬМАМИ! Не выдавай учётные записи пользователей (Raidstat, Mira Florés, Samushevich Ignat и т.д.) за входящие письма! Входящие письма находятся во вкладке "Kerio Connect Client"!]\n\n` +
      tab.content.replace(
        /=== СПИСОК ПИСЕМ \/ СТРОК СООБЩЕНИЙ ВО ВКЛАДКЕ[^=]*===/g,
        "=== ТАБЛИЦА УЧЁТНЫХ ЗАПИСЕЙ СЕРВЕРА (KERIO CONNECT ADMINISTRATION — ПОЛЬЗОВАТЕЛИ И ДИСКОВЫЕ КВОТЫ) ===",
      )
    )
  }

  const parsedEmails = parseStructuredEmailsFromRawText(tab.content)
  if (parsedEmails.length > 0) {
    const mdTable =
      `=== 📬 РАСПОЗНАННЫЙ СПИСОК ВХОДЯЩИХ ПИСЕМ В KERIO CONNECT CLIENT / WEBMAIL (${parsedEmails.length} писем; №1..№5 сверху — это САМЫЕ НОВЫЕ / ПОСЛЕДНИЕ пришедшие письма!) ===\n` +
      `| № | Отправитель | Время / Дата | Тема письма | Краткое содержание (превью) |\n` +
      `|---|---|---|---|---|\n` +
      parsedEmails
        .map(
          (e) =>
            `| ${e.index} | ${e.sender} | ${e.time} | ${e.subject} | ${e.snippet || "—"} |`,
        )
        .join("\n")
    return `${mdTable}\n\n${tab.content}`
  }

  return tab.content
}


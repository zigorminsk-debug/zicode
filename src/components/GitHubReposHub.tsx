import React, { useEffect, useMemo, useState } from "react"

/**
 * ZiCode · «Работа с репозиториями GitHub»
 * ---------------------------------------------------------------------------
 * Открывается кнопкой «🐙 Репозитории» прямо из чата.
 * Показывает список репозиториев пользователя и даёт готовые сценарии:
 *   • анализ README и документации;
 *   • полный анализ кода / архитектуры;
 *   • дописывание функционала;
 *   • исправление ошибок;
 *   • сборка программы средствами GitHub Actions.
 * Плюс отдельный режим «Просто чат» для локальных разноплановых задач —
 * в нём браузер и репозиторий не используются вообще.
 */

const GH_TOKEN_KEY = "zicode_github_token"
const GH_REPO_KEY = "zicode_github_repo"

export interface RepoTaskRequest {
  repo: string
  branch: string
  action: string
  prompt: string
  files: Record<string, string>
}

interface GitHubReposHubProps {
  open: boolean
  isMobile: boolean
  activeRepo: { repo: string; branch: string } | null
  onClose: () => void
  onRunTask: (req: RepoTaskRequest) => void
  onOpenLocalChat: () => void
}

const ghHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
})

/** Корректное UTF-8 декодирование base64 из GitHub Contents API */
export const decodeBase64Utf8 = (base64: string): string => {
  try {
    const binary = atob(base64.replace(/\n/g, ""))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder("utf-8").decode(bytes)
  } catch {
    return ""
  }
}

const SOURCE_FILE_RE =
  /\.(ts|tsx|js|jsx|cjs|mjs|json|md|mdx|py|html|css|scss|yml|yaml|sh|bat|ps1|txt|kt|java|gradle|xml|toml|ini|sql|go|rs|rb|php|cs|cpp|c|h|swift|dart)$/i

const IGNORED_PREFIXES = [
  "node_modules/",
  "dist/",
  "build/",
  "release-builds/",
  ".git/",
  "coverage/",
  "vendor/",
  "__pycache__/",
  ".gradle/",
  "android/app/build/",
]

/**
 * Загружает README, манифесты и исходники репозитория в рабочую область.
 * Сначала README/manifest-файлы, затем остальные исходники (до `maxFiles`).
 */
export async function fetchRepoSnapshot(
  token: string,
  repo: string,
  branch: string,
  maxFiles = 28,
): Promise<{ files: Record<string, string>; totalFiles: number; readmePath: string }> {
  const repoPath = repo.trim()
  const branchRef = encodeURIComponent(branch.trim() || "main")
  const treeRes = await fetch(`https://api.github.com/repos/${repoPath}/git/trees/${branchRef}?recursive=1`, {
    headers: ghHeaders(token),
  })
  const treeData: any = await treeRes.json().catch(() => ({}))
  if (!treeRes.ok) {
    throw new Error(treeData?.message || `Не удалось прочитать дерево репозитория (HTTP ${treeRes.status})`)
  }

  const blobs = (Array.isArray(treeData.tree) ? treeData.tree : []).filter(
    (item: any) =>
      item &&
      item.type === "blob" &&
      (item.size ?? 0) < 160000 &&
      !IGNORED_PREFIXES.some((p) => String(item.path).startsWith(p)),
  )

  const priority = (p: string) =>
    /(^|\/)readme(\.(md|mdx|txt|rst))?$/i.test(p)
      ? 0
      : /(^|\/)(package\.json|tsconfig\.json|vite\.config\.[jt]s|build\.gradle|settings\.gradle|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|dockerfile|makefile|\.github\/workflows\/[^/]+)$/i.test(
            p,
          )
        ? 1
        : /(^|\/)agents\.md$/i.test(p)
          ? 2
          : /\.(ts|tsx|js|jsx|py|java|kt|go|rs|dart|swift|cs|cpp|c|h)$/i.test(p)
            ? 3
            : 4

  const candidates = blobs
    .filter((item: any) => SOURCE_FILE_RE.test(String(item.path)))
    .sort((a: any, b: any) => priority(String(a.path)) - priority(String(b.path)) || String(a.path).localeCompare(String(b.path)))
    .slice(0, Math.max(1, maxFiles))

  const files: Record<string, string> = {}
  let readmePath = ""
  await Promise.all(
    candidates.map(async (blob: any) => {
      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${repoPath}/contents/${blob.path}?ref=${encodeURIComponent(branch.trim() || "main")}`,
          { headers: ghHeaders(token) },
        )
        if (!contentRes.ok) return
        const contentData: any = await contentRes.json()
        if (!contentData?.content) return
        const text = decodeBase64Utf8(String(contentData.content))
        if (!text) return
        files[blob.path] = text
        if (!readmePath && /(^|\/)readme/i.test(String(blob.path))) readmePath = String(blob.path)
      } catch {}
    }),
  )

  return { files, totalFiles: blobs.length, readmePath }
}

const ACTION_DEFS = [
  {
    id: "readme",
    icon: "📖",
    title: "Анализ README",
    hint: "Разбор документации: о чём проект, как собрать и что стоит дописать",
  },
  {
    id: "analyze",
    icon: "🧭",
    title: "Полный анализ кода",
    hint: "Архитектура, структура, риски и план улучшений с приоритетами",
  },
  {
    id: "extend",
    icon: "✍️",
    title: "Дописать код",
    hint: "Описать, какой функционал нужно добавить — агент напишет файлы",
  },
  {
    id: "fix",
    icon: "🐞",
    title: "Исправить ошибки",
    hint: "Найти и устранить баги, привести код в рабочее состояние",
  },
  {
    id: "actions",
    icon: "🚀",
    title: "Сборка в GitHub Actions",
    hint: "Запустить workflow сборки, посмотреть статус или создать build.yml",
  },
] as const

type ActionId = (typeof ACTION_DEFS)[number]["id"]

const actionTitle = (id: ActionId) => ACTION_DEFS.find((a) => a.id === id)?.title ?? "Работа с репозиторием"

export const GitHubReposHub: React.FC<GitHubReposHubProps> = ({
  open,
  isMobile,
  activeRepo,
  onClose,
  onRunTask,
  onOpenLocalChat,
}) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem(GH_TOKEN_KEY) || "")
  const [showToken, setShowToken] = useState<boolean>(false)
  const [user, setUser] = useState<any>(null)
  const [repos, setRepos] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string>(() => activeRepo?.repo || localStorage.getItem(GH_REPO_KEY) || "")
  const [branches, setBranches] = useState<string[]>([])
  const [branch, setBranch] = useState<string>(activeRepo?.branch || "main")
  const [action, setAction] = useState<ActionId>("readme")
  const [taskText, setTaskText] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [workflows, setWorkflows] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [snapshotInfo, setSnapshotInfo] = useState<{ repo: string; count: number } | null>(null)

  const saveToken = (val: string) => {
    setToken(val)
    localStorage.setItem(GH_TOKEN_KEY, val)
  }

  const loadRepos = async (authToken = token) => {
    if (!authToken.trim()) {
      setStatus("⚠️ Подключите GitHub: вставьте Personal Access Token (классический или fine-grained со scope «repo»).")
      return
    }
    setBusy(true)
    setStatus("Подключение к GitHub API...")
    try {
      const uRes = await fetch("https://api.github.com/user", { headers: ghHeaders(authToken) })
      const uData: any = await uRes.json().catch(() => ({}))
      if (!uRes.ok) throw new Error(uData?.message || `HTTP ${uRes.status}`)
      setUser(uData)

      const rRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator", {
        headers: ghHeaders(authToken),
      })
      const rData: any = await rRes.json().catch(() => [])
      if (!rRes.ok) throw new Error(rData?.message || `HTTP ${rRes.status}`)
      const list = Array.isArray(rData) ? rData : []
      setRepos(list)
      setStatus(`✅ Подключено: @${uData.login} · репозиториев: ${list.length}`)
      if (!selected && list.length > 0) {
        setSelected(list[0].full_name)
        setBranch(list[0].default_branch || "main")
      }
    } catch (err: any) {
      setStatus(`❌ GitHub: ${err?.message || "ошибка подключения"}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    if (token.trim()) loadRepos(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Загрузка веток выбранного репозитория
  useEffect(() => {
    if (!open || !selected.trim() || !token.trim()) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${selected.trim()}/branches?per_page=100`, {
          headers: ghHeaders(token),
        })
        if (!res.ok) return
        const data: any = await res.json()
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const names = data.map((b: any) => String(b.name))
          setBranches(names)
          if (!names.includes(branch)) setBranch(names[0])
        }
      } catch {}
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, token])

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return repos
    return repos.filter((r) => `${r.full_name} ${r.description || ""} ${r.language || ""}`.toLowerCase().includes(q))
  }, [repos, search])

  const selectedMeta = useMemo(
    () => repos.find((r) => r.full_name === selected) || (selected ? { full_name: selected, default_branch: branch } : null),
    [repos, selected, branch],
  )

  const buildPrompt = (id: ActionId, repo: string, br: string): string => {
    const head = `Репозиторий: ${repo} (ветка ${br}). Файлы репозитория уже загружены в рабочую область.`
    if (id === "readme") {
      return `${head}

Проанализируй README и документацию этого репозитория и дай разбор по пунктам:
1. Что это за проект, для кого и какую задачу решает (2–4 предложения).
2. Технологический стек и ключевые зависимости.
3. Как собрать, запустить и протестировать проект (точные команды).
4. Какие важные разделы отсутствуют или устарели в README (установка, переменные окружения, архитектура, лицензия, скриншоты, примеры использования).
5. Готовый улучшенный README.md целиком в блоке кода (на русском), сохранив фактическую информацию проекта.
Не читай открытые вкладки браузера — работай только с файлами репозитория.`
    }
    if (id === "analyze") {
      return `${head}

Сделай полный технический анализ репозитория:
1. Структура проекта и назначение ключевых каталогов/файлов.
2. Архитектура и поток данных (как связаны модули).
3. Качество кода: дублирование, мёртвый код, отсутствие типов, потенциальные баги.
4. Безопасность и работа с секретами/токенами.
5. Тесты, CI/CD и сборка — что есть и чего не хватает.
6. План улучшений списком с приоритетами (P0/P1/P2) и конкретными шагами.
Не читай открытые вкладки браузера — работай только с файлами репозитория.`
    }
    if (id === "extend") {
      return `${head}

Задача — дописать функционал: ${taskText.trim() || "улучшить существующую логику и закрыть очевидные пробелы"}.

Действуй как инженер:
1. Определи, в какие существующие файлы нужно внести изменения и какие новые файлы создать.
2. Выдай готовый рабочий код: для каждого файла укажи путь и полное содержимое в блоке кода (не «...», а целиком).
3. Обнови README/инструкции, если появились новые команды или настройки.
4. Кратко перечисли, что проверено и как это запустить.
Не читай открытые вкладки браузера — работай только с файлами репозитория.`
    }
    if (id === "fix") {
      return `${head}

Найди и исправь ошибки в коде: ${taskText.trim() || "проведи ревизию проекта и устрани явные баги, падения и ошибки сборки"}.

Формат ответа:
1. Список найденных проблем (файл:строка — суть — почему это ошибка).
2. Исправленные файлы целиком в блоках кода с путями.
3. Что нужно сделать пользователю, чтобы отправить изменения на GitHub (кнопка Push / коммит-сообщение).
Не читай открытые вкладки браузера — работай только с файлами репозитория.`
    }
    return `${head}

Настрой сборку программы средствами GitHub Actions:
1. Определи стек проекта по файлам (Node/TypeScript, Python, Java/Android и т. д.).
2. Проверь, есть ли .github/workflows. Если нет — создай готовый workflow-файл, который собирает проект и загружает артефакт (APK/EXE/архив) в GitHub Release или artifacts.
3. Дай полное содержимое workflow-файла в блоке кода с путём.
4. Объясни, какие секреты нужно добавить в настройки репозитория и как запустить сборку кнопкой «Run workflow».
Не читай открытые вкладки браузера — работай только с файлами репозитория.`
  }

  const runTask = async (id: ActionId) => {
    const repo = selected.trim()
    if (!repo) {
      setStatus("⚠️ Сначала выберите репозиторий из списка.")
      return
    }
    const br = (branch || "main").trim()
    setAction(id)
    setBusy(true)
    setStatus(`Загрузка файлов ${repo} (${br})...`)
    try {
      const snapshot = await fetchRepoSnapshot(token, repo, br)
      const files = snapshot.files

      setSnapshotInfo({ repo: `${repo}@${br}`, count: Object.keys(files).length })
      setStatus(
        `✅ Загружено ${Object.keys(files).length} файлов из ${repo} (${br}). Запускаю агента…`,
      )
      localStorage.setItem(GH_REPO_KEY, repo)
      localStorage.setItem(`${GH_REPO_KEY}_branch`, br)
      onRunTask({
        repo,
        branch: br,
        action: actionTitle(id),
        prompt: buildPrompt(id, repo, br),
        files,
      })
    } catch (err: any) {
      setStatus(`❌ Не удалось загрузить репозиторий: ${err?.message || "неизвестная ошибка"}`)
    } finally {
      setBusy(false)
    }
  }

  const justLoadFiles = async () => {
    const repo = selected.trim()
    if (!repo) {
      setStatus("⚠️ Сначала выберите репозиторий из списка.")
      return
    }
    const br = (branch || "main").trim()
    setBusy(true)
    setStatus(`Загрузка файлов ${repo} (${br}) в рабочую область...`)
    try {
      const snapshot = await fetchRepoSnapshot(token, repo, br)
      const count = Object.keys(snapshot.files).length
      setSnapshotInfo({ repo: `${repo}@${br}`, count })
      localStorage.setItem(GH_REPO_KEY, repo)
      localStorage.setItem(`${GH_REPO_KEY}_branch`, br)
      setStatus(`✅ Загружено ${count} файлов из ${repo} (${br}). Можно работать в редакторе и в чате.`)
      onRunTask({ repo, branch: br, action: "Загрузка файлов в рабочую область", prompt: "", files: snapshot.files })
    } catch (err: any) {
      setStatus(`❌ Не удалось загрузить репозиторий: ${err?.message || "неизвестная ошибка"}`)
    } finally {
      setBusy(false)
    }
  }

  const loadActions = async () => {
    const repo = selected.trim()
    if (!repo) return
    setBusy(true)
    setStatus("Читаю workflow и последние запуски GitHub Actions...")
    try {
      const wRes = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, { headers: ghHeaders(token) })
      const wData: any = await wRes.json().catch(() => ({}))
      setWorkflows(wRes.ok && Array.isArray(wData.workflows) ? wData.workflows : [])
      const rRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=6`, {
        headers: ghHeaders(token),
      })
      const rData: any = await rRes.json().catch(() => ({}))
      setRuns(rRes.ok && Array.isArray(rData.workflow_runs) ? rData.workflow_runs : [])
      setStatus(
        wRes.ok
          ? `✅ Найдено workflow: ${wData.workflows?.length ?? 0}, последних запусков: ${rData.workflow_runs?.length ?? 0}`
          : `⚠️ GitHub Actions: ${wData?.message || `HTTP ${wRes.status}`}`,
      )
    } catch (err: any) {
      setStatus(`❌ Ошибка GitHub Actions: ${err?.message || "неизвестная ошибка"}`)
    } finally {
      setBusy(false)
    }
  }

  const dispatchWorkflow = async (workflowId: number, ref: string) => {
    const repo = selected.trim()
    setBusy(true)
    setStatus("Запускаю сборку в GitHub Actions...")
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`, {
        method: "POST",
        headers: ghHeaders(token),
        body: JSON.stringify({ ref }),
      })
      if (res.status === 204) {
        setStatus(`✅ Сборка запущена: ${ref}. Откройте вкладку Actions на GitHub, чтобы следить за прогрессом.`)
        await loadActions()
      } else {
        const data: any = await res.json().catch(() => ({}))
        setStatus(
          `❌ Не удалось запустить сборку: ${data?.message || `HTTP ${res.status}`}. Токену нужен scope «workflow», а в workflow должен быть \`workflow_dispatch\`.`,
        )
      }
    } catch (err: any) {
      setStatus(`❌ Ошибка запуска сборки: ${err?.message || "неизвестная ошибка"}`)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(3, 6, 10, 0.78)",
    backdropFilter: "blur(4px)",
    zIndex: 95,
    display: "flex",
    alignItems: isMobile ? "stretch" : "center",
    justifyContent: "center",
    padding: isMobile ? 0 : "24px",
  }

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "1040px",
    maxHeight: isMobile ? "100vh" : "90vh",
    height: isMobile ? "100%" : undefined,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: isMobile ? 0 : "12px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  }

  return (
    <div style={panelStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: isMobile ? "10px 12px" : "14px 18px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--bg-tertiary)",
          }}
        >
          <div style={{ fontSize: isMobile ? "16px" : "18px", fontWeight: 700, flex: 1, minWidth: 0 }}>
            🐙 Работа с репозиториями GitHub
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
              Анализ · Дописывание кода · Исправления · Сборка через GitHub Actions
            </div>
          </div>
          <button
            onClick={onOpenLocalChat}
            title="Закрыть репозитории и просто общаться с агентом по локальным задачам"
            style={{
              padding: "6px 10px",
              borderRadius: "7px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            💬 {isMobile ? "Чат" : "Просто чат"}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "20px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Token bar */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="GitHub Personal Access Token (ghp_… / github_pat_…)"
            style={{
              flex: 1,
              minWidth: isMobile ? "100%" : "220px",
              padding: "7px 9px",
              borderRadius: "7px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <button
            onClick={() => setShowToken((v) => !v)}
            title="Показать / скрыть токен"
            style={{
              padding: "7px 9px",
              borderRadius: "7px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            {showToken ? "🙈" : "👁"}
          </button>
          <button
            onClick={() => loadRepos()}
            disabled={busy}
            style={{
              padding: "7px 11px",
              borderRadius: "7px",
              background: "var(--accent)",
              border: "none",
              color: "#0a0c10",
              fontSize: "11px",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🔌 Подключить
          </button>
          {user && (
            <span style={{ fontSize: "11px", color: "var(--success)", whiteSpace: "nowrap" }}>
              @{user.login}
            </span>
          )}
        </div>

        {status && (
          <div
            style={{
              padding: "7px 12px",
              fontSize: "11px",
              color: status.startsWith("❌") ? "var(--danger)" : status.startsWith("⚠️") ? "var(--warning, #f0b429)" : "var(--text-secondary)",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-primary)",
            }}
          >
            {status}
          </div>
        )}

        {/* Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          {/* Repo list */}
          <div
            style={{
              width: isMobile ? "100%" : "300px",
              maxHeight: isMobile ? (selected ? "0px" : "100%") : undefined,
              overflow: isMobile && selected ? "hidden" : "auto",
              borderRight: isMobile ? "none" : "1px solid var(--border-color)",
              padding: "10px",
              display: isMobile && selected ? "none" : "block",
              flexShrink: 0,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск репозитория…"
              style={{
                width: "100%",
                padding: "7px 9px",
                borderRadius: "7px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "12px",
                marginBottom: "8px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
              {repos.length === 0
                ? "Список пуст — подключите GitHub токеном выше."
                : `Репозитории (${filteredRepos.length}/${repos.length})`}
            </div>
            {filteredRepos.map((r) => (
              <div
                key={r.id ?? r.full_name}
                onClick={() => {
                  setSelected(r.full_name)
                  setBranch(r.default_branch || "main")
                  setWorkflows([])
                  setRuns([])
                  setSnapshotInfo(null)
                }}
                style={{
                  padding: "8px 9px",
                  borderRadius: "8px",
                  marginBottom: "6px",
                  cursor: "pointer",
                  border:
                    selected === r.full_name
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border-color)",
                  background: selected === r.full_name ? "rgba(56,189,248,0.1)" : "var(--bg-primary)",
                }}
              >
                <div className="mono" style={{ fontSize: "12px", fontWeight: 600, wordBreak: "break-word" }}>
                  {r.private ? "🔒 " : "🌐 "}
                  {r.full_name}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {[r.language, r.default_branch, r.updated_at ? new Date(r.updated_at).toLocaleDateString("ru-RU") : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            ))}
          </div>

          {/* Repo detail & actions */}
          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "16px", minWidth: 0 }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
              {isMobile && (
                <button
                  onClick={() => setSelected("")}
                  style={{
                    padding: "5px 9px",
                    borderRadius: "7px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-secondary)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  ← Список
                </button>
              )}
              <div style={{ flex: 1, minWidth: "140px" }}>
                <div className="mono" style={{ fontSize: "14px", fontWeight: 700, wordBreak: "break-word" }}>
                  {selected ? selectedMeta?.full_name : "Выберите репозиторий"}
                </div>
                {selectedMeta?.description && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {selectedMeta.description}
                  </div>
                )}
              </div>
              {selected && (
                <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "5px" }}>
                  Ветка
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    style={{
                      padding: "5px 7px",
                      borderRadius: "6px",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      maxWidth: "170px",
                    }}
                  >
                    {(branches.length > 0 ? branches : [branch]).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {!selected && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7 }}>
                Выберите репозиторий в списке слева — откроются готовые сценарии работы.
                <br />
                Нужна обычная задача по коду на вашем компьютере? Нажмите «💬 Просто чат» выше —
                агент не будет обращаться ни к GitHub, ни к вкладкам браузера.
              </div>
            )}

            {selected && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {ACTION_DEFS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        if (a.id === "actions") {
                          setAction("actions")
                          loadActions()
                        } else {
                          runTask(a.id)
                        }
                      }}
                      disabled={busy}
                      style={{
                        textAlign: "left",
                        padding: "10px",
                        borderRadius: "9px",
                        border: action === a.id ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                        background: action === a.id ? "rgba(56,189,248,0.1)" : "var(--bg-primary)",
                        color: "var(--text-primary)",
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.65 : 1,
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: 700 }}>
                        {a.icon} {a.title}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.5 }}>
                        {a.hint}
                      </div>
                    </button>
                  ))}
                </div>

                {(action === "extend" || action === "fix") && (
                  <div style={{ marginBottom: "12px" }}>
                    <textarea
                      value={taskText}
                      onChange={(e) => setTaskText(e.target.value)}
                      rows={3}
                      placeholder={
                        action === "extend"
                          ? "Что нужно дописать? Например: добавь REST API для задач с валидацией и тестами"
                          : "Что исправить? Например: приложение падает при запуске без .env — сделай конфиг безопасным"
                      }
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "9px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        resize: "vertical",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => runTask(action)}
                        disabled={busy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "7px",
                          background: "var(--accent)",
                          border: "none",
                          color: "#0a0c10",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        {busy ? "Загрузка…" : `▶ ${action === "extend" ? "Дописать код" : "Исправить код"}`}
                      </button>
                      <button
                        onClick={justLoadFiles}
                        title="Загрузить README и исходники репозитория в рабочую область, чтобы работать в редакторе и чате"
                        disabled={busy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "7px",
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-secondary)",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        📂 Загрузить файлы в рабочую область
                      </button>
                    </div>
                  </div>
                )}

                {action === "actions" && (
                  <div
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "9px",
                      padding: "10px",
                      background: "var(--bg-primary)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                      🚀 GitHub Actions этого репозитория
                    </div>
                    {workflows.length === 0 && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                        Workflow не найдены (или токену не хватает прав). Нажмите «Создать workflow сборки» —
                        агент сгенерирует <span className="mono">.github/workflows/build.yml</span> под стек проекта.
                      </div>
                    )}
                    {workflows.map((w) => (
                      <div
                        key={w.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 0",
                          borderTop: "1px solid var(--border-color)",
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="mono" style={{ fontSize: "11px", flex: 1, minWidth: "140px", wordBreak: "break-word" }}>
                          {w.path}
                        </span>
                        <button
                          onClick={() => dispatchWorkflow(w.id, branch)}
                          disabled={busy}
                          style={{
                            padding: "5px 9px",
                            borderRadius: "6px",
                            background: "var(--success)",
                            border: "none",
                            color: "#04120a",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          ▶ Run workflow
                        </button>
                      </div>
                    ))}
                    {runs.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                          Последние запуски
                        </div>
                        {runs.map((r) => (
                          <div key={r.id} style={{ fontSize: "11px", padding: "3px 0", color: "var(--text-secondary)" }}>
                            {r.name || r.display_title || "workflow"} —{" "}
                            <span
                              style={{
                                color:
                                  r.conclusion === "success"
                                    ? "var(--success)"
                                    : r.conclusion === "failure"
                                      ? "var(--danger)"
                                      : "var(--text-secondary)",
                                fontWeight: 600,
                              }}
                            >
                              {r.status === "completed" ? r.conclusion : r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => runTask("actions")}
                        disabled={busy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "7px",
                          background: "var(--accent)",
                          border: "none",
                          color: "#0a0c10",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        🧩 Создать workflow сборки
                      </button>
                      <button
                        onClick={loadActions}
                        disabled={busy}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "7px",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-secondary)",
                          fontSize: "12px",
                          cursor: busy ? "not-allowed" : "pointer",
                        }}
                      >
                        🔄 Обновить статус
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "10px", lineHeight: 1.6 }}>
                  💡 В режиме репозитория агент работает только с файлами кода и НЕ читает открытые вкладки браузера.
                  Для задач с почтой или сайтами нажмите «💬 Просто чат» и явно попросите прочитать вкладку.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

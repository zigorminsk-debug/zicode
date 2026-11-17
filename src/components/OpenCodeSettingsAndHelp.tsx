import React, { useState, useEffect } from "react"
import {
  ArrowLeft,
  Search,
  Cpu,
  Sparkles,
  Puzzle,
  FolderGit2,
  GitBranch,
  Sliders,
  Palette,
  Bell,
  Keyboard,
  Link2,
  Server,
  FlaskConical,
  Info,
  CheckCircle2,
  Download,
  Plus,
  Upload,
  RefreshCw,
  BookOpen,
  KeyRound,
  Users,
  GitPullRequest,
  FolderPlus,
  Globe,
  ExternalLink,
} from "lucide-react"
import {
  ModelInfo,
  ProviderInfo,
  McpServerConfig,
  BrowserTabItem,
  ThemePalette,
} from "../core/types"
import { BUILTIN_SKILLS } from "../core/workspace"

export type SettingsTabId =
  | "providers"
  | "models"
  | "extensions"
  | "projects"
  | "workspaces"
  | "general"
  | "appearance"
  | "notifications"
  | "shortcuts"
  | "pairing"
  | "servers"
  | "experimental"
  | "about"

interface OpenCodeSettingsModalProps {
  initialTab?: SettingsTabId
  onClose: () => void
  providers: ProviderInfo[]
  models: ModelInfo[]
  selectedProviderId: string
  selectedModelId: string
  onSelectModel: (providerId: string, modelId: string) => void
  enabledModels: Record<string, boolean>
  onToggleModel: (key: string, enabled: boolean) => void
  apiKeys: Record<string, string>
  onSaveApiKey: (providerId: string, key: string) => void
  customBaseUrls: Record<string, string>
  onSaveBaseUrl: (providerId: string, url: string) => void
  themes: ThemePalette[]
  themeId: string
  onSelectTheme: (id: string) => void
  mcpServers: McpServerConfig[]
  onToggleMcp: (id: string) => void
  files: Record<string, string>
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onCreateNewProject: (projectName: string, template: string) => void
  browserTabs: BrowserTabItem[]
  onOpenGitHubTab: () => void
  onOpenHelpTab: () => void
}

export const OpenCodeSettingsScreen: React.FC<OpenCodeSettingsModalProps> = ({
  initialTab = "models",
  onClose,
  providers,
  models,
  selectedProviderId,
  selectedModelId,
  onSelectModel,
  enabledModels,
  onToggleModel,
  apiKeys,
  onSaveApiKey,
  customBaseUrls,
  onSaveBaseUrl,
  themes,
  themeId,
  onSelectTheme,
  mcpServers,
  onToggleMcp,
  files,
  onCreateNewProject,
  browserTabs,
  onOpenGitHubTab,
  onOpenHelpTab,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab)
  const [navSearch, setNavSearch] = useState("")
  const [modelSearch, setModelSearch] = useState("")
  const [collapsedProviders, setCollapsedProviders] = useState<Record<string, boolean>>({})
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState("my-ai-project")
  const [newProjectTemplate, setNewProjectTemplate] = useState("ts-app")
  const [extSubTab, setExtSubTab] = useState<"mcp" | "skills" | "chrome">("mcp")
  const [notifAgent, setNotifAgent] = useState(true)
  const [notifPerms, setNotifPerms] = useState(true)
  const [notifErrors, setNotifErrors] = useState(true)
  const [soundAgent, setSoundAgent] = useState(true)
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const navGroups: {
    items: { id: SettingsTabId; label: string; icon: React.ReactNode }[]
  }[] = [
    {
      items: [
        { id: "providers", label: "Провайдеры", icon: <Cpu size={16} /> },
        { id: "models", label: "Модели", icon: <Sparkles size={16} /> },
        { id: "extensions", label: "Расширения", icon: <Puzzle size={16} /> },
        { id: "projects", label: "Проекты", icon: <FolderGit2 size={16} /> },
        { id: "workspaces", label: "Рабочие пространства", icon: <GitBranch size={16} /> },
      ],
    },
    {
      items: [
        { id: "general", label: "Предпочтения", icon: <Sliders size={16} /> },
        { id: "appearance", label: "Внешний вид", icon: <Palette size={16} /> },
        { id: "notifications", label: "Уведомления", icon: <Bell size={16} /> },
        { id: "shortcuts", label: "Горячие клавиши", icon: <Keyboard size={16} /> },
        { id: "pairing", label: "Pairing", icon: <Link2 size={16} /> },
        { id: "servers", label: "Сервер", icon: <Server size={16} /> },
      ],
    },
    {
      items: [
        { id: "experimental", label: "Экспериментальный", icon: <FlaskConical size={16} /> },
        { id: "about", label: "О нас", icon: <Info size={16} /> },
      ],
    },
  ]

  const allNavItems = navGroups.flatMap((g) => g.items)

  const isModelVisible = (providerId: string, modelId: string) => {
    const key = `${providerId}:${modelId}`
    return enabledModels[key] !== false
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        overflow: "hidden",
      }}
    >
      {/* MOBILE TOP NAVIGATION BAR (for Android / small screens) */}
      {isMobile ? (
        <div
          style={{
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-color)",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <button
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "8px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={15} />
              <span>Назад</span>
            </button>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => {
                  onClose()
                  onOpenGitHubTab()
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 9px",
                  borderRadius: "7px",
                  background: "rgba(59, 130, 246, 0.14)",
                  color: "#60a5fa",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                <FolderGit2 size={13} /> GitHub
              </button>
              <button
                onClick={() => {
                  onClose()
                  onOpenHelpTab()
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 9px",
                  borderRadius: "7px",
                  background: "rgba(34, 197, 94, 0.14)",
                  color: "var(--success)",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                <BookOpen size={13} /> Справка
              </button>
            </div>
          </div>

          {/* Horizontal Swipeable Category Tabs on Android */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "2px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {allNavItems.map((item) => {
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--border-color)",
                    background: active ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: active ? 700 : 500,
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: active ? "var(--accent)" : "var(--text-muted)", display: "flex" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        /* DESKTOP LEFT SIDEBAR: Exact replica of OpenCode Desktop Settings Navigation (image-5.png) */
        <aside
          style={{
            width: "260px",
            borderRight: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
            display: "flex",
            flexDirection: "column",
            padding: "20px 14px",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 10px",
              borderRadius: "8px",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "16px",
              textAlign: "left",
            }}
          >
            <ArrowLeft size={16} />
            <span>Назад в приложение</span>
          </button>

          {/* Search input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 10px",
              borderRadius: "8px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              marginBottom: "14px",
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Поиск"
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                width: "100%",
                fontSize: "13px",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Navigation Groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1 }}>
            {navGroups.map((group, gIdx) => {
              const filteredItems = group.items.filter(
                (it) => !navSearch.trim() || it.label.toLowerCase().includes(navSearch.toLowerCase()),
              )
              if (filteredItems.length === 0) return null
              return (
                <div key={gIdx} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {filteredItems.map((item) => {
                    const active = activeTab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: active ? "var(--bg-elevated)" : "transparent",
                          color: active ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: active ? 600 : 400,
                          fontSize: "13px",
                          textAlign: "left",
                          transition: "background 0.15s",
                        }}
                      >
                        <span style={{ color: active ? "var(--accent)" : "var(--text-muted)", display: "flex" }}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Quick Links to Help & GitHub Collaboration */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <button
              onClick={() => {
                onClose()
                onOpenGitHubTab()
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "rgba(59, 130, 246, 0.14)",
                color: "#60a5fa",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <FolderGit2 size={14} /> GitHub по API-ключу
            </button>
            <button
              onClick={() => {
                onClose()
                onOpenHelpTab()
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "rgba(34, 197, 94, 0.14)",
                color: "var(--success)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <BookOpen size={14} /> Полная справка и гайд
            </button>
          </div>
        </aside>
      )}

      {/* RIGHT CONTENT AREA */}
      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "32px 44px" }}>
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>
          {/* =================================================================
              TAB: МОДЕЛИ (Exact replica of image-4.png!)
             ================================================================= */}
          {activeTab === "models" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Модели</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "18px" }}>
                Настройки моделей будут доступны здесь. Все модели <b>OpenCode Free</b> подключены сразу по умолчанию ($0, без API-ключа).
              </div>

              {/* Search Models Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "22px",
                }}
              >
                <Search size={15} color="var(--text-muted)" />
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Поиск моделей"
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "13px",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Grouped by Provider — OpenCode Free first, exact layout of image-4.png */}
              {providers.map((prov) => {
                const provModels = models
                  .filter((m) => m.providerID === prov.id)
                  .filter(
                    (m) =>
                      !modelSearch.trim() ||
                      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                      m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
                      prov.name.toLowerCase().includes(modelSearch.toLowerCase()),
                  )
                  .sort((a, b) => a.name.localeCompare(b.name))

                if (provModels.length === 0) return null
                const isCollapsed = Boolean(collapsedProviders[prov.id])

                return (
                  <div key={prov.id} style={{ marginBottom: "24px" }}>
                    {/* Provider Group Header: ⌄ [OpenCode Icon] OpenCode Free */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "10px",
                      }}
                    >
                      <button
                        onClick={() =>
                          setCollapsedProviders((prev) => ({ ...prev, [prov.id]: !prev[prov.id] }))
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          background: "transparent",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          fontSize: "14px",
                          padding: "4px 2px",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                          {isCollapsed ? "▸" : "▾"}
                        </span>
                        <span
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "4px",
                            border: "2px solid var(--text-primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "9px",
                            fontWeight: 800,
                          }}
                        >
                          {prov.id === "opencode" ? "OC" : prov.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>{prov.id === "opencode" ? "OpenCode Free" : prov.name}</span>
                        {prov.freeAvailable && (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 7px",
                              borderRadius: "99px",
                              background: "rgba(74, 222, 128, 0.16)",
                              color: "var(--success)",
                              fontWeight: 700,
                            }}
                          >
                            Подключено ($0)
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Models List Card */}
                    {!isCollapsed && (
                      <div
                        style={{
                          borderRadius: "12px",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-secondary)",
                          overflow: "hidden",
                        }}
                      >
                        {provModels.map((m, idx) => {
                          const enabled = isModelVisible(prov.id, m.id)
                          const isCurrent = selectedProviderId === prov.id && selectedModelId === m.id
                          return (
                            <div
                              key={m.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "13px 18px",
                                borderBottom:
                                  idx < provModels.length - 1 ? "1px solid var(--border-color)" : "none",
                                background: isCurrent ? "rgba(59, 130, 246, 0.08)" : "transparent",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                <span style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text-primary)" }}>
                                  {m.name}
                                </span>
                                {m.free && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: "rgba(74, 222, 128, 0.14)",
                                      color: "var(--success)",
                                      fontWeight: 600,
                                    }}
                                  >
                                    FREE
                                  </span>
                                )}
                                {isCurrent && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      padding: "1px 7px",
                                      borderRadius: "4px",
                                      background: "var(--accent)",
                                      color: "#0a0c10",
                                      fontWeight: 700,
                                    }}
                                  >
                                    АКТИВНА В ЧАТЕ
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                {!isCurrent && (
                                  <button
                                    onClick={() => {
                                      onToggleModel(`${prov.id}:${m.id}`, true)
                                      onSelectModel(prov.id, m.id)
                                    }}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: "6px",
                                      background: "var(--bg-elevated)",
                                      border: "1px solid var(--border-color)",
                                      color: "var(--text-secondary)",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Выбрать для чата
                                  </button>
                                )}

                                {/* Blue Toggle Switch (exact match of image-4.png) */}
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={enabled}
                                  onClick={() => onToggleModel(`${prov.id}:${m.id}`, !enabled)}
                                  style={{
                                    width: "38px",
                                    height: "21px",
                                    borderRadius: "99px",
                                    background: enabled ? "#2563eb" : "var(--bg-elevated)",
                                    border: enabled ? "1px solid #3b82f6" : "1px solid var(--border-color)",
                                    position: "relative",
                                    padding: 0,
                                    transition: "background 0.15s",
                                    flexShrink: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: "2px",
                                      left: enabled ? "19px" : "2px",
                                      width: "15px",
                                      height: "15px",
                                      borderRadius: "50%",
                                      background: "#ffffff",
                                      transition: "left 0.15s",
                                    }}
                                  />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* =================================================================
              TAB: ПРОВАЙДЕРЫ
             ================================================================= */}
          {activeTab === "providers" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Провайдеры</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "22px" }}>
                Настройки провайдеров будут доступны здесь. Провайдер <b>OpenCode Free</b> подключён автоматически из коробки.
              </div>

              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: "var(--text-secondary)" }}>
                Подключённые провайдеры
              </h3>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  marginBottom: "24px",
                  overflow: "hidden",
                }}
              >
                {providers
                  .filter((p) => p.id === "opencode" || p.freeAvailable || Boolean(apiKeys[p.id]))
                  .map((p, idx, arr) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "14px 18px",
                        borderBottom: idx < arr.length - 1 ? "1px solid var(--border-color)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
                            <CheckCircle2 size={15} color="var(--success)" />
                            <span>{p.name}</span>
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background: "var(--bg-elevated)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {p.id === "opencode" ? "Среда (apiKey=public)" : apiKeys[p.id] ? "API-ключ" : "Бесплатный пул"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
                            {p.description}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingProviderId(editingProviderId === p.id ? null : p.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                            fontSize: "12px",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {editingProviderId === p.id ? "Скрыть" : "Настроить"}
                        </button>
                      </div>

                      {editingProviderId === p.id && (
                        <div
                          style={{
                            marginTop: "12px",
                            paddingTop: "12px",
                            borderTop: "1px solid var(--border-color)",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px",
                          }}
                        >
                          <div>
                            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                              API Key ({p.envVar}):
                            </label>
                            <input
                              type="password"
                              value={apiKeys[p.id] ?? ""}
                              onChange={(e) => onSaveApiKey(p.id, e.target.value)}
                              placeholder={p.defaultApiKey ? `По умолчанию: ${p.defaultApiKey} (бесплатно)` : "Введите API ключ..."}
                              style={{
                                width: "100%",
                                padding: "7px 10px",
                                borderRadius: "6px",
                                background: "var(--bg-primary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                                fontSize: "12px",
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                              Base URL:
                            </label>
                            <input
                              type="text"
                              value={customBaseUrls[p.id] ?? p.baseURL}
                              onChange={(e) => onSaveBaseUrl(p.id, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "7px 10px",
                                borderRadius: "6px",
                                background: "var(--bg-primary)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                                fontSize: "12px",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px", color: "var(--text-secondary)" }}>
                Другие провайдеры (по API-ключу)
              </h3>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  overflow: "hidden",
                }}
              >
                {providers
                  .filter((p) => !p.freeAvailable && !apiKeys[p.id])
                  .map((p, idx, arr) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "14px 18px",
                        borderBottom: idx < arr.length - 1 ? "1px solid var(--border-color)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{p.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{p.description}</div>
                        </div>
                        <button
                          onClick={() => setEditingProviderId(editingProviderId === p.id ? null : p.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: "var(--accent)",
                            color: "#0a0c10",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          Подключить
                        </button>
                      </div>
                      {editingProviderId === p.id && (
                        <div style={{ marginTop: "10px" }}>
                          <input
                            type="password"
                            value={apiKeys[p.id] ?? ""}
                            onChange={(e) => onSaveApiKey(p.id, e.target.value)}
                            placeholder={`Вставьте ${p.envVar}...`}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              background: "var(--bg-primary)",
                              border: "1px solid var(--border-color)",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: РАСШИРЕНИЯ (МКП, Навыки, Chrome Bridge)
             ================================================================= */}
          {activeTab === "extensions" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Расширения</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "18px" }}>
                Управление расширениями МКП (MCP), навыками (Skills) и расширением Google Chrome.
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
                {[
                  { id: "mcp", label: "МКП (MCP Серверы)" },
                  { id: "skills", label: "Навыки (Skills)" },
                  { id: "chrome", label: `🌐 Расширение Chrome (${browserTabs.length} вкладок)` },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setExtSubTab(st.id as any)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      background: extSubTab === st.id ? "var(--accent)" : "var(--bg-secondary)",
                      color: extSubTab === st.id ? "#0a0c10" : "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: "12px",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {extSubTab === "mcp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {mcpServers.map((srv) => (
                    <div
                      key={srv.id}
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{srv.name}</div>
                        <div className="mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {srv.endpoint}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          Инструменты: {srv.tools.join(", ")}
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleMcp(srv.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          background: srv.enabled ? "var(--success)" : "var(--bg-elevated)",
                          color: srv.enabled ? "#0a0c10" : "var(--text-secondary)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {srv.enabled ? "Включён" : "Выключен"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {extSubTab === "skills" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {BUILTIN_SKILLS.map((sk) => (
                    <div
                      key={sk.slug}
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{sk.name}</div>
                      <div className="mono" style={{ fontSize: "11px", color: "var(--accent)", marginBottom: "6px" }}>
                        {sk.path}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{sk.description}</div>
                    </div>
                  ))}
                </div>
              )}

              {extSubTab === "chrome" && (
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "var(--accent)" }}>
                    🌐 ZiCode Chrome Bridge (Чтение открытых страниц браузера)
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: 1.5 }}>
                    Статус: <b>Синхронизировано {browserTabs.length} открытых вкладок</b> через <code>http://127.0.0.1:4096/api/browser/sync</code>.
                  </p>
                  <a
                    href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.7.1/ZiCode-Chrome-Extension-v2.7.1.zip"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      background: "var(--accent)",
                      color: "#0a0c10",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: "12px",
                    }}
                  >
                    <Download size={14} /> Скачать ZiCode-Chrome-Extension-v2.7.1.zip
                  </a>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB: ПРОЕКТЫ (Мастер создания нового проекта + управление)
             ================================================================= */}
          {activeTab === "projects" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Проекты</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Создайте новый проект с нуля или управляйте настройками текущего проекта.
              </div>

              <div
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "20px",
                }}
              >
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "10px", color: "var(--accent)" }}>
                  🚀 Создать свой проект с нуля
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Название проекта:
                    </label>
                    <input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="my-awesome-app"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Шаблон проекта:
                    </label>
                    <select
                      value={newProjectTemplate}
                      onChange={(e) => setNewProjectTemplate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="ts-app">TypeScript + React Web App</option>
                      <option value="python-api">Python FastAPI / AI Bot</option>
                      <option value="node-cli">Node.js Backend / REST API</option>
                      <option value="empty">Пустой проект (только opencode.json и AGENTS.md)</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onCreateNewProject(newProjectName || "new-project", newProjectTemplate)
                    onClose()
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    background: "var(--accent)",
                    color: "#0a0c10",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  <FolderPlus size={15} /> Создать проект и открыть в рабочей области
                </button>
              </div>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
                  Текущий активный проект ({Object.keys(files).length} файлов)
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Файлы: {Object.keys(files).join(", ")}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: РАБОЧИЕ ПРОСТРАНСТВА
             ================================================================= */}
          {activeTab === "workspaces" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Рабочие пространства</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Управление локальными рабочими пространствами и синхронизацией с GitHub по API-ключу.
              </div>
              <div
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>
                  🐙 Совместная работа через GitHub API
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  Подключите ваш Personal Access Token (API Key) от GitHub, чтобы клонировать репозитории в рабочую область, пушить коммиты и создавать Pull Request для командной работы.
                </p>
                <button
                  onClick={() => {
                    onClose()
                    onOpenGitHubTab()
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "var(--accent)",
                    color: "#0a0c10",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Открыть панель GitHub & Совместная работа
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: ПРЕДПОЧТЕНИЯ (GENERAL)
             ================================================================= */}
          {activeTab === "general" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Предпочтения</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Настройте язык интерфейса, оболочку терминала и поведение агентов по умолчанию.
              </div>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  overflow: "hidden",
                }}
              >
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
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>Язык</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Язык отображения интерфейса OpenCode / ZiCode
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Русский (RU)</span>
                </div>
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
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>Оболочка терминала</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Используется инструментом bash и командами !команда
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>Авто (по умолчанию)</span>
                </div>
                <div
                  style={{
                    padding: "14px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>Автоподключение OpenCode Free</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      Активировать бесплатные модели с apiKey=&quot;public&quot; при запуске
                    </div>
                  </div>
                  <span style={{ color: "var(--success)", fontWeight: 700, fontSize: "13px" }}>Включено</span>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: ВНЕШНИЙ ВИД (APPEARANCE)
             ================================================================= */}
          {activeTab === "appearance" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Внешний вид</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Настройте тему оформления OpenCode и цветовую палитру.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: "12px",
                }}
              >
                {themes.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => onSelectTheme(th.id)}
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: th.bgSecondary,
                      border: themeId === th.id ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
                      color: th.textPrimary,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>{th.name}</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[th.bgPrimary, th.accent, th.accentSecondary, th.success].map((c, idx) => (
                        <span
                          key={idx}
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            background: c,
                            border: "1px solid rgba(255,255,255,0.2)",
                          }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: УВЕДОМЛЕНИЯ (NOTIFICATIONS)
             ================================================================= */}
          {activeTab === "notifications" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Уведомления</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Выберите, когда получать системные уведомления и звуковые сигналы.
              </div>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  overflow: "hidden",
                }}
              >
                {[
                  {
                    title: "Агент завершил задачу",
                    desc: "Показывать уведомление, когда ИИ-агент завершил генерацию ответа",
                    val: notifAgent,
                    set: setNotifAgent,
                  },
                  {
                    title: "Запрос разрешений",
                    desc: "Уведомлять, когда инструмент question ждёт ответа пользователя",
                    val: notifPerms,
                    set: setNotifPerms,
                  },
                  {
                    title: "Ошибки выполнения",
                    desc: "Показывать уведомление при возникновении ошибок",
                    val: notifErrors,
                    set: setNotifErrors,
                  },
                  {
                    title: "Звуковые эффекты",
                    desc: "Воспроизводить звук по завершении шага агента",
                    val: soundAgent,
                    set: setSoundAgent,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "14px 18px",
                      borderBottom: idx < 3 ? "1px solid var(--border-color)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{item.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={(e) => item.set(e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "#2563eb" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: ГОРЯЧИЕ КЛАВИШИ (SHORTCUTS)
             ================================================================= */}
          {activeTab === "shortcuts" && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>Горячие клавиши</h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Клавиатурные сокращения OpenCode Studio и TUI.
              </div>
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  overflow: "hidden",
                }}
              >
                {[
                  { key: "Tab", action: "Переключить агента Build ↔ Plan" },
                  { key: "Enter", action: "Отправить сообщение агенту" },
                  { key: "Shift + Enter", action: "Новая строка в поле ввода" },
                  { key: "/", action: "Открыть меню слэш-команд (/init, /review, /models, /undo)" },
                  { key: "@", action: "Прикрепить файл из проекта в контекст (@opencode.json)" },
                  { key: "!", action: "Выполнить прямую shell-команду (!git status)" },
                ].map((sc, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 18px",
                      borderBottom: idx < 5 ? "1px solid var(--border-color)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "13px" }}>{sc.action}</span>
                    <kbd
                      className="mono"
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-color)",
                        fontSize: "12px",
                      }}
                    >
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: PAIRING & СЕРВЕР
             ================================================================= */}
          {(activeTab === "pairing" || activeTab === "servers") && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>
                {activeTab === "pairing" ? "Pairing (Связь с браузером и Android)" : "Сервер OpenCode"}
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Управление подключением к локальному серверу <code>http://127.0.0.1:4096</code> и расширению Chrome.
              </div>
              <div
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <CheckCircle2 size={16} color="var(--success)" />
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>
                    Локальный сервер активен: http://127.0.0.1:4096
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  • Мост расширения Google Chrome: <code>POST http://127.0.0.1:4096/api/browser/sync</code> (синхронизировано вкладок: <b>{browserTabs.length}</b>)
                  <br />• Прокси бесплатных моделей OpenCode Free: <code>POST http://127.0.0.1:4096/api/ai/proxy</code>
                  <br />• Каталог моделей OpenCode v2: <code>GET http://127.0.0.1:4096/api/models-dev</code>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB: ЭКСПЕРИМЕНТАЛЬНЫЙ & О НАС
             ================================================================= */}
          {(activeTab === "experimental" || activeTab === "about") && (
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>
                {activeTab === "experimental" ? "Экспериментальный" : "О программе ZiCode (OpenCode v2.4)"}
              </h2>
              <div
                style={{
                  padding: "18px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  marginTop: "14px",
                  lineHeight: 1.6,
                  fontSize: "13px",
                }}
              >
                <p>
                  <b>ZiCode v2.4.0</b> — кроссплатформенная среда ИИ-разработки для <b>Windows (.exe)</b> и <b>Android (Signed APK)</b>, созданная по архитектуре <code>anomalyco/opencode</code> со 100% поддержкой всех бесплатных моделей <b>OpenCode Free</b>, интеграцией с <b>GitHub по API-ключу</b> и расширением <b>ZiCode Chrome Bridge</b>.
                </p>
                <p style={{ marginTop: "8px", color: "var(--text-secondary)" }}>
                  Постоянный ключ подписи Android APK (RSA-2048, до 2054 г.):
                  <br />
                  <code>SHA-256: 47:D7:9F:24:7A:E2:10:35:A6:74:5B:A7:7B:91:4F:68:7E:8B:A8:A7:ED:76:3D:61:51:1B:4B:4B:64:15:12:55</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ============================================================================
// GITHUB API COLLABORATION COMPONENT (Подключение к GitHub по API-ключу)
// ============================================================================
interface GitHubCollaborationProps {
  files: Record<string, string>
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSelectFile: (path: string) => void
}

export const GitHubCollaborationView: React.FC<GitHubCollaborationProps> = ({
  files,
  setFiles,
  onSelectFile,
}) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem("zicode_github_token") || "")
  const [userInfo, setUserInfo] = useState<any>(null)
  const [repos, setRepos] = useState<any[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string>(
    () => localStorage.getItem("zicode_github_repo") || "zigorminsk-debug/zicode",
  )
  const [branch, setBranch] = useState<string>("main")
  const [commitMessage, setCommitMessage] = useState<string>("feat: update project files from ZiCode Studio")
  const [newRepoName, setNewRepoName] = useState<string>("")
  const [newRepoPrivate, setNewRepoPrivate] = useState<boolean>(false)
  const [collabUsername, setCollabUsername] = useState<string>("")
  const [prTitle, setPrTitle] = useState<string>("")
  const [prHead, setPrHead] = useState<string>("")
  const [prBase, setPrBase] = useState<string>("main")
  const [statusMsg, setStatusMsg] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const saveToken = (val: string) => {
    setToken(val)
    localStorage.setItem("zicode_github_token", val)
  }

  const ghHeaders = () => ({
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  })

  const verifyAndLoadRepos = async () => {
    if (!token.trim()) {
      setStatusMsg("⚠️ Введите ваш GitHub Personal Access Token (API Key) в поле выше.")
      return
    }
    setLoading(true)
    setStatusMsg("Проверка ключа GitHub API...")
    try {
      const uRes = await fetch("https://api.github.com/user", { headers: ghHeaders() })
      if (!uRes.ok) throw new Error(`Ошибка авторизации GitHub HTTP ${uRes.status}`)
      const user = await uRes.json()
      setUserInfo(user)

      const rRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30", {
        headers: ghHeaders(),
      })
      if (rRes.ok) {
        const repoList = await rRes.json()
        setRepos(Array.isArray(repoList) ? repoList : [])
        if (repoList.length > 0 && !selectedRepo) {
          setSelectedRepo(repoList[0].full_name)
        }
      }
      setStatusMsg(`✅ Успешно подключён аккаунт GitHub: @${user.login} (${user.name || "Developer"})`)
    } catch (err: any) {
      setStatusMsg(`❌ Ошибка подключения: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token.trim()) {
      verifyAndLoadRepos()
    }
  }, [])

  const handleCreateRepo = async () => {
    if (!token.trim() || !newRepoName.trim()) {
      setStatusMsg("⚠️ Укажите токен GitHub и название нового репозитория.")
      return
    }
    setLoading(true)
    setStatusMsg(`Создание репозитория ${newRepoName}...`)
    try {
      const res = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: ghHeaders(),
        body: JSON.stringify({
          name: newRepoName.trim(),
          private: newRepoPrivate,
          auto_init: true,
          description: "Created with ZiCode (OpenCode Studio for Windows & Android)",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
      setSelectedRepo(data.full_name)
      localStorage.setItem("zicode_github_repo", data.full_name)
      setBranch(data.default_branch || "main")
      setNewRepoName("")
      setStatusMsg(`✅ Создан новый репозиторий: ${data.full_name} (${data.html_url})`)
      verifyAndLoadRepos()
    } catch (err: any) {
      setStatusMsg(`❌ Не удалось создать репозиторий: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePullFromGitHub = async () => {
    if (!selectedRepo.trim()) {
      setStatusMsg("⚠️ Укажите репозиторий в формате owner/repo")
      return
    }
    setLoading(true)
    setStatusMsg(`Загрузка файлов из ${selectedRepo} (ветка ${branch})...`)
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${selectedRepo.trim()}/git/trees/${encodeURIComponent(branch.trim())}?recursive=1`,
        { headers: ghHeaders() },
      )
      const treeData = await treeRes.json()
      if (!treeRes.ok) throw new Error(treeData.message || `HTTP ${treeRes.status}`)

      const blobs = (treeData.tree || [])
        .filter(
          (item: any) =>
            item.type === "blob" &&
            item.size < 120000 &&
            !item.path.startsWith("node_modules/") &&
            !item.path.startsWith("dist/") &&
            !item.path.startsWith(".git/") &&
            /\.(ts|tsx|js|cjs|mjs|json|md|py|html|css|yml|yaml|sh|txt|kt|java|gradle)$/i.test(item.path),
        )
        .slice(0, 25)

      const loadedFiles: Record<string, string> = {}
      for (const blob of blobs) {
        const fRes = await fetch(
          `https://api.github.com/repos/${selectedRepo.trim()}/contents/${blob.path}?ref=${encodeURIComponent(branch.trim())}`,
          { headers: ghHeaders() },
        )
        if (fRes.ok) {
          const fData = await fRes.json()
          if (fData.content && fData.encoding === "base64") {
            const decoded = decodeURIComponent(
              Array.prototype.map
                .call(atob(fData.content.replace(/\n/g, "")), (c: string) => {
                  return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                })
                .join(""),
            )
            loadedFiles[blob.path] = decoded
          }
        }
      }

      if (Object.keys(loadedFiles).length > 0) {
        setFiles(loadedFiles)
        onSelectFile(Object.keys(loadedFiles)[0])
        setStatusMsg(
          `✅ Загружено ${Object.keys(loadedFiles).length} файлов из ${selectedRepo} (${branch}) в рабочую область!`,
        )
      } else {
        setStatusMsg("⚠️ В репозитории не найдено текстовых файлов подходящего формата.")
      }
    } catch (err: any) {
      setStatusMsg(`❌ Ошибка загрузки из GitHub: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePushToGitHub = async () => {
    if (!token.trim() || !selectedRepo.trim()) {
      setStatusMsg("⚠️ Для отправки изменений (Push) укажите ваш GitHub API Key и репозиторий.")
      return
    }
    setLoading(true)
    const entries = Object.entries(files)
    setStatusMsg(`Отправка ${entries.length} файлов в ${selectedRepo} (ветка ${branch})...`)
    let pushedCount = 0
    try {
      for (const [filePath, content] of entries) {
        // Check if file already exists to get its sha
        let sha: string | undefined
        const checkRes = await fetch(
          `https://api.github.com/repos/${selectedRepo.trim()}/contents/${filePath}?ref=${encodeURIComponent(branch.trim())}`,
          { headers: ghHeaders() },
        )
        if (checkRes.ok) {
          const existing = await checkRes.json()
          sha = existing.sha
        }

        const b64 = btoa(
          encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_match, p1) =>
            String.fromCharCode(parseInt(p1, 16)),
          ),
        )

        const putRes = await fetch(`https://api.github.com/repos/${selectedRepo.trim()}/contents/${filePath}`, {
          method: "PUT",
          headers: ghHeaders(),
          body: JSON.stringify({
            message: commitMessage || "Update from ZiCode Studio",
            content: b64,
            branch: branch.trim(),
            ...(sha ? { sha } : {}),
          }),
        })
        if (!putRes.ok) {
          const errData = await putRes.json()
          throw new Error(`${filePath}: ${errData.message || putRes.status}`)
        }
        pushedCount++
      }
      setStatusMsg(
        `✅ Успешно отправлено (Commit & Push) ${pushedCount} файлов в https://github.com/${selectedRepo.trim()}/tree/${branch.trim()} !`,
      )
    } catch (err: any) {
      setStatusMsg(`❌ Ошибка при отправке в GitHub: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCollaborator = async () => {
    if (!token.trim() || !selectedRepo.trim() || !collabUsername.trim()) {
      setStatusMsg("⚠️ Укажите токен, репозиторий и логин участника GitHub.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.github.com/repos/${selectedRepo.trim()}/collaborators/${collabUsername.trim()}`,
        {
          method: "PUT",
          headers: ghHeaders(),
          body: JSON.stringify({ permission: "push" }),
        },
      )
      if (res.status === 201 || res.status === 204) {
        setStatusMsg(`✅ Пользователь @${collabUsername.trim()} приглашён к совместной работе над ${selectedRepo}!`)
        setCollabUsername("")
      } else {
        const d = await res.json()
        throw new Error(d.message || `HTTP ${res.status}`)
      }
    } catch (err: any) {
      setStatusMsg(`❌ Ошибка добавления соавтора: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePullRequest = async () => {
    if (!token.trim() || !selectedRepo.trim() || !prTitle.trim() || !prHead.trim()) {
      setStatusMsg("⚠️ Укажите заголовок PR, исходную ветку (head) и целевую ветку (base).")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`https://api.github.com/repos/${selectedRepo.trim()}/pulls`, {
        method: "POST",
        headers: ghHeaders(),
        body: JSON.stringify({
          title: prTitle.trim(),
          head: prHead.trim(),
          base: prBase.trim() || "main",
          body: "Pull Request создан из среды разработки ZiCode (OpenCode Studio).",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
      setStatusMsg(`✅ Создан Pull Request #${data.number}: ${data.html_url}`)
      setPrTitle("")
    } catch (err: any) {
      setStatusMsg(`❌ Ошибка создания PR: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px", lineHeight: 1.6, fontSize: "13px" }}>
      <h2 style={{ fontSize: "18px", color: "var(--accent)", marginBottom: "6px" }}>
        🐙 Подключение к GitHub по API-ключу и совместная работа
      </h2>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
        Подключите ваш GitHub Personal Access Token (<code>ghp_...</code> или <code>github_pat_...</code>), чтобы создавать репозитории, загружать чужие или общие проекты, отправлять коммиты напрямую из ZiCode и приглашать участников команды.
      </p>

      {statusMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--accent)",
            marginBottom: "14px",
            fontWeight: 600,
            fontSize: "12px",
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* 1. API Key Connection Card */}
      <div
        style={{
          padding: "14px",
          borderRadius: "10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
            <KeyRound size={15} color="var(--accent)" />
            <span>1. GitHub API Key (Personal Access Token)</span>
          </div>
          <a
            href="https://github.com/settings/tokens/new?scopes=repo,workflow,read:org&description=ZiCode+Studio"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: "11px",
              color: "var(--accent-secondary)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Создать токен на GitHub в 1 клик <ExternalLink size={12} />
          </a>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="password"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="Вставьте ваш ключ ghp_xxxxxxxxxxxx или github_pat_xxxx..."
            style={{
              flex: 1,
              minWidth: "240px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              fontSize: "12px",
            }}
          />
          <button
            onClick={verifyAndLoadRepos}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: "var(--accent)",
              color: "#0a0c10",
              fontWeight: 700,
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={13} /> Проверить и подключить
          </button>
        </div>

        {userInfo && (
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12px",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={15} />
            <span>
              Подключён профиль: <b>@{userInfo.login}</b> ({userInfo.name || "GitHub User"}) · Доступно репозиториев: {repos.length}
            </span>
          </div>
        )}
      </div>

      {/* 2. Repository Sync (Pull & Commit/Push) */}
      <div
        style={{
          padding: "14px",
          borderRadius: "10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
          <FolderGit2 size={15} color="var(--accent-secondary)" />
          <span>2. Работа с репозиторием (Загрузка проекта / Отправка коммитов)</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
              Репозиторий (owner/repo):
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                value={selectedRepo}
                onChange={(e) => {
                  setSelectedRepo(e.target.value)
                  localStorage.setItem("zicode_github_repo", e.target.value)
                }}
                placeholder="owner/repository"
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              />
              {repos.length > 0 && (
                <select
                  value={selectedRepo}
                  onChange={(e) => {
                    setSelectedRepo(e.target.value)
                    localStorage.setItem("zicode_github_repo", e.target.value)
                  }}
                  style={{
                    maxWidth: "180px",
                    padding: "7px",
                    borderRadius: "6px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    fontSize: "11px",
                  }}
                >
                  {repos.map((r) => (
                    <option key={r.id} value={r.full_name}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
              Ветка (branch):
            </label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: "6px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "12px",
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Сообщение коммита (Commit message):
          </label>
          <input
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "6px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              fontSize: "12px",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handlePullFromGitHub}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Download size={14} /> Загрузить файлы из GitHub в ZiCode (Pull)
          </button>

          <button
            onClick={handlePushToGitHub}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: "var(--success)",
              color: "#0a0c10",
              fontWeight: 700,
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Upload size={14} /> Отправить все файлы проекта в GitHub (Commit & Push)
          </button>
        </div>
      </div>

      {/* 3. Create New GitHub Repository & Team Collaboration */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "14px" }}>
        <div
          style={{
            padding: "14px",
            borderRadius: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={15} color="var(--accent)" />
            <span>3. Создать новый репозиторий на GitHub</span>
          </div>
          <input
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            placeholder="Название нового репозитория (напр. my-zicode-app)"
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "6px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              fontSize: "12px",
              marginBottom: "8px",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={newRepoPrivate}
                onChange={(e) => setNewRepoPrivate(e.target.checked)}
              />
              Приватный репозиторий
            </label>
            <button
              onClick={handleCreateRepo}
              disabled={loading}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--accent)",
                color: "#0a0c10",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Создать на GitHub
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "14px",
            borderRadius: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={15} color="var(--accent-secondary)" />
            <span>4. Пригласить коллегу к совместной работе</span>
          </div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            <input
              value={collabUsername}
              onChange={(e) => setCollabUsername(e.target.value)}
              placeholder="Логин участника на GitHub"
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: "6px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "12px",
              }}
            />
            <button
              onClick={handleAddCollaborator}
              disabled={loading}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--accent-secondary)",
                color: "#0a0c10",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              Пригласить
            </button>
          </div>

          <div style={{ fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <GitPullRequest size={14} color="var(--success)" />
            <span>Создать Pull Request:</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <input
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="Заголовок PR"
              style={{
                flex: 1,
                minWidth: "110px",
                padding: "6px 8px",
                borderRadius: "6px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "11px",
              }}
            />
            <input
              value={prHead}
              onChange={(e) => setPrHead(e.target.value)}
              placeholder="Из ветки (head)"
              style={{
                width: "110px",
                padding: "6px 8px",
                borderRadius: "6px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontSize: "11px",
              }}
            />
            <button
              onClick={handleCreatePullRequest}
              disabled={loading}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              Открыть PR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPREHENSIVE IN-APP HELP & USER GUIDE VIEW («📖 Справка и руководство»)
// ============================================================================
interface HelpAndGuideProps {
  onOpenSettings: (tab: SettingsTabId) => void
  onOpenGitHub: () => void
  onOpenBrowserTab: () => void
  onCreateNewProject: (name: string, template: string) => void
}

export const HelpAndGuideView: React.FC<HelpAndGuideProps> = ({
  onOpenSettings,
  onOpenGitHub,
  onOpenBrowserTab,
  onCreateNewProject,
}) => {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px", lineHeight: 1.65, fontSize: "13px" }}>
      <h2 style={{ fontSize: "20px", color: "var(--accent)", marginBottom: "6px" }}>
        📖 Полная справка по работе с программой ZiCode (OpenCode Studio)
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "18px" }}>
        Подробное руководство: как настроить бесплатные ИИ-модели, как создать свой проект с нуля, как подключить GitHub по API-ключу для совместной работы и как подключить расширение Google Chrome.
      </p>

      {/* Quick Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => onOpenSettings("models")}
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            textAlign: "left",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: "4px" }}>
            ✨ 1. Меню «Модели» (OpenCode Free)
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Все 18 бесплатных моделей (Beam Free, Big Pickle, DeepSeek V4.1, GLM-5.3, Hy4, Iceman, LongCat 2.5 и др.) уже включены!
          </div>
        </button>

        <button
          onClick={() => onOpenSettings("projects")}
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            textAlign: "left",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
            🚀 2. Создать свой проект
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Открыть мастер создания проекта (TypeScript/React, Python, Node.js или пустой шаблон).
          </div>
        </button>

        <button
          onClick={onOpenGitHub}
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            textAlign: "left",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: "4px" }}>
            🐙 3. Подключить GitHub по API-ключу
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Клонирование репозиториев, отправка коммитов (Push), создание PR и совместная работа.
          </div>
        </button>

        <button
          onClick={onOpenBrowserTab}
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            textAlign: "left",
            color: "var(--text-primary)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--accent-secondary)", marginBottom: "4px" }}>
            🌐 4. Подключить браузер Chrome
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Инструкция и скачивание расширения ZiCode Chrome Bridge для чтения открытых вкладок.
          </div>
        </button>
      </div>

      {/* SECTION 0: КНОПКА «РАБОТА С РЕПОЗИТОРИЯМИ GITHUB» В ЧАТЕ */}
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "rgba(56, 189, 248, 0.08)",
          border: "1px solid var(--accent)",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent)", marginBottom: "8px" }}>
          🐙 Кнопка «Работа с репозиториями GitHub» в чате
        </h3>
        <p style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>
          Над полем ввода в чате есть кнопка <b>«🐙 Работа с репозиториями GitHub»</b> (и компактная кнопка{" "}
          <b>🐙</b> рядом со скрепкой). Она открывает список ваших репозиториев и готовые сценарии:
        </p>
        <ol style={{ paddingLeft: "18px", margin: "0 0 8px", color: "var(--text-secondary)" }}>
          <li>
            <b>📖 Анализ README</b> — разбор документации: о чём проект, стек, как собрать, чего не хватает, плюс готовый улучшенный <code>README.md</code>.
          </li>
          <li>
            <b>🧭 Полный анализ кода</b> — структура, архитектура, качество кода, безопасность и план улучшений P0/P1/P2.
          </li>
          <li>
            <b>✍️ Дописать код</b> — опишите, что нужно добавить, и агент выдаст готовые файлы целиком.
          </li>
          <li>
            <b>🐞 Исправить ошибки</b> — ревизия проекта и готовые исправления с путями файлов.
          </li>
          <li>
            <b>🚀 Сборка в GitHub Actions</b> — запуск workflow кнопкой <code>Run workflow</code>, просмотр последних запусков
            или генерация нового <code>.github/workflows/build.yml</code> под стек проекта.
          </li>
        </ol>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "12px" }}>
          💬 Кнопка <b>«Просто чат»</b> в этом окне (и «× Выйти» над полем ввода) выключает режим репозитория: агент выполняет
          любые локальные задачи — код, тексты, расчёты — и <b>не читает открытые вкладки браузера</b>. Браузер используется
          только если вы сами об этом попросите.
        </p>
      </div>

      {/* SECTION 1: КАК НАСТРОИТЬ ПРОГРАММУ И БЕСПЛАТНЫЕ МОДЕЛИ */}
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--success)", marginBottom: "8px" }}>
          1. Как настроить программу и почему бесплатные модели подключены сразу
        </h3>
        <ol style={{ paddingLeft: "18px", margin: 0, color: "var(--text-secondary)" }}>
          <li>
            <b>Никаких ключей для старта не требуется:</b> при запуске ZiCode автоматически активирует встроенный провайдер <b>OpenCode Free</b> с публичным ключом <code>apiKey = &quot;public&quot;</code>.
          </li>
          <li>
            Чтобы открыть полноэкранное меню настроек (как в оригинальном OpenCode Desktop), нажмите на иконку шестерёнки <b>⚙️</b> в правом верхнем углу окна или введите команду <code>/models</code> в чате.
          </li>
          <li>
            В разделе <b>«Модели» → «OpenCode Free»</b> все бесплатные модели (<b>Beam Free, Big Pickle, DeepSeek V4.1 Flash Free, Flint 40B Free, GLM-5.3-Flash Free, Hy4 flash Free, Iceman Free, Inkling 2 Small Free, LongCat 2.5 Free, MiMo-V2.6-Flash Free, Nemotron 3.5 Lightning Free</b> и др.) сразу включены синими переключателями.
          </li>
          <li>
            Если вы хотите подключить платные или внешние провайдеры (OpenRouter, Anthropic, OpenAI, DeepSeek, Z.AI, Google Gemini, локальный Ollama), перейдите в <b>⚙️ Настройки → Провайдеры</b> и нажмите <b>«Настроить»</b>.
          </li>
        </ol>
      </div>

      {/* SECTION 2: КАК СОЗДАТЬ СВОЙ ПРОЕКТ С НУЛЯ */}
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent)", marginBottom: "8px" }}>
          2. Как создать свой собственный проект с нуля
        </h3>
        <ol style={{ paddingLeft: "18px", margin: 0, color: "var(--text-secondary)" }}>
          <li>
            <b>Способ А (через Мастер проектов):</b> Нажмите <b>⚙️ Настройки → Проекты</b> (или кнопку ниже), введите имя проекта, выберите шаблон (<i>TypeScript + React, Python FastAPI, Node.js Backend</i> или <i>Пустой проект</i>) и нажмите <b>«Создать проект»</b>.
          </li>
          <li>
            <b>Способ Б (через диалог с ИИ):</b> Просто напишите в чате с агентом <b>BUILD</b>:
            <br />
            <code>Создай проект калькулятора / телеграм-бота / сайта в папке src/ и инициализируй AGENTS.md</code>
            <br />
            Агент сам создаст файлы с помощью инструмента <code>write</code> и покажет изменения во вкладке <b>«Diff изменений»</b>.
          </li>
          <li>
            <b>Способ В (вручную в боковой панели):</b> В левой панели <b>«Файлы»</b> нажмите кнопку <b>«+ Новый»</b>, укажите путь (например, <code>src/index.ts</code>), отредактируйте код во вкладке <b>«Редактор»</b> и нажмите <b>«На диск»</b> (файл сохранится в папку <code>workspace-out/</code> рядом с программой) или <b>«Скачать»</b>.
          </li>
          <li>
            <b>Инициализация правил для ИИ:</b> Введите в чате слэш-команду <code>/init</code> — программа автоматически сгенерирует файл <code>AGENTS.md</code> с описанием архитектуры вашего проекта.
          </li>
        </ol>
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={() => onCreateNewProject("my-new-app", "ts-app")}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              background: "var(--accent)",
              color: "#0a0c10",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            + Быстро создать шаблон проекта TypeScript в 1 клик
          </button>
        </div>
      </div>

      {/* SECTION 3: КАК ПОДКЛЮЧИТЬ GITHUB ПО API KEY ДЛЯ СОВМЕСТНОЙ РАБОТЫ */}
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#60a5fa", marginBottom: "8px" }}>
          3. Как подключить GitHub по API-ключу для совместной работы
        </h3>
        <ol style={{ paddingLeft: "18px", margin: 0, color: "var(--text-secondary)" }}>
          <li>
            Перейдите во вкладку <b>«🐙 GitHub API»</b> в верхней панели рабочей области.
          </li>
          <li>
            Нажмите ссылку <b>«Создать токен на GitHub в 1 клик»</b> (откроется страница GitHub с уже отмеченными правами <code>repo</code> и <code>workflow</code>), сгенерируйте токен <code>ghp_...</code> и вставьте его в поле <b>GitHub API Key</b>.
          </li>
          <li>
            Нажмите <b>«Проверить и подключить»</b> — программа загрузит ваш профиль и список всех ваших репозиториев.
          </li>
          <li>
            <b>Для совместной работы над общим проектом:</b>
            <ul>
              <li>Выберите репозиторий из списка (или введите <code>owner/repo</code> коллеги) и нажмите <b>«Загрузить файлы из GitHub в ZiCode (Pull)»</b>.</li>
              <li>Попросите ИИ-агента внести нужные доработки или отредактируйте файлы в редакторе.</li>
              <li>Нажмите <b>«Отправить все файлы проекта в GitHub (Commit &amp; Push)»</b> — изменения мгновенно отправятся в ветку репозитория!</li>
              <li>В блоке <b>«Пригласить коллегу»</b> вы можете добавить участника по его логину GitHub или создать <b>Pull Request</b> для код-ревью.</li>
            </ul>
          </li>
        </ol>
      </div>

      {/* SECTION 4: КАК ПОДКЛЮЧИТЬ РАСШИРЕНИЕ GOOGLE CHROME */}
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-secondary)", marginBottom: "8px" }}>
          4. Как подключить расширение Google Chrome (ZiCode Chrome Bridge)
        </h3>
        <ol style={{ paddingLeft: "18px", margin: 0, color: "var(--text-secondary)" }}>
          <li>
            Скачайте архив расширения{" "}
            <a
              href="https://github.com/zigorminsk-debug/zicode/releases/download/v2.7.1/ZiCode-Chrome-Extension-v2.7.1.zip"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              ZiCode-Chrome-Extension-v2.7.1.zip
            </a>{" "}
            и распакуйте его в любую папку.
          </li>
          <li>
            Откройте в браузере Chrome страницу <code>chrome://extensions</code> и включите <b>«Режим разработчика»</b> (правый верхний угол).
          </li>
          <li>
            Нажмите <b>«Загрузить распакованное расширение»</b> (Load unpacked) и выберите распакованную папку.
          </li>
          <li>
            Расширение каждые 3 секунды автоматически передаёт список ваших открытых вкладок и текст страниц в программу ZiCode (на <code>http://127.0.0.1:4096/api/browser/sync</code>).
          </li>
          <li>
            Перейдите во вкладку <b>«🌐 Браузер Chrome»</b> в ZiCode или напишите в чате: <i>«Какие вкладки у меня сейчас открыты в браузере?»</i> / <i>«Прочитай мою активную вкладку и перескажи суть»</i>.
          </li>
        </ol>
      </div>
    </div>
  )
}

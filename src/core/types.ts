export type AgentMode = "primary" | "subagent"

export type PermissionEffect = "allow" | "ask" | "deny"

export interface PermissionRule {
  action: string
  resource: string
  effect: PermissionEffect
}

export interface AgentInfo {
  id: string
  name: string
  description: string
  mode: AgentMode
  hidden?: boolean
  systemPrompt: string
  permissions: PermissionRule[]
  modelOverride?: string
  temperature?: number
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max"
  color: string
}

export type ApiProtocol = "chat-completions" | "responses" | "messages" | "generate-content" | "systemone"

export interface ModelInfo {
  id: string
  providerID: string
  name: string
  family?: string
  free: boolean
  status?: "active" | "deprecated" | "beta"
  type: "chat" | "decision"
  protocol: ApiProtocol
  baseURL: string
  contextLimit: number
  outputLimit: number
  costInput: number
  costOutput: number
  capabilities: {
    tools: boolean
    reasoning: boolean
    reasoningEffort?: string[]
    vision: boolean
  }
  description?: string
}

export interface ProviderInfo {
  id: string
  name: string
  badge: string
  freeAvailable: boolean
  requiresKey: boolean
  defaultApiKey?: string
  envVar: string
  baseURL: string
  protocol: ApiProtocol
  description: string
  website?: string
}

export type ToolStatus = "pending" | "running" | "completed" | "error"

export interface ToolCallRecord {
  id: string
  name: string
  args: Record<string, unknown>
  status: ToolStatus
  output?: string
  diff?: string
  durationMs?: number
  error?: string
}

export interface QuestionOption {
  id: string
  label: string
  description?: string
}

export interface QuestionPrompt {
  id: string
  question: string
  options: QuestionOption[]
  answered?: string
}

export interface ArtifactItem {
  id: string
  title: string
  type: "html" | "svg" | "markdown" | "code" | "mermaid"
  language?: string
  content: string
  createdAt: number
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  reasoning?: string
  agentId: string
  modelId: string
  providerId: string
  timestamp: number
  toolCalls?: ToolCallRecord[]
  question?: QuestionPrompt
  artifact?: ArtifactItem
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  snapshotId?: string
  isSyntheticReminder?: boolean
}

export interface TodoItem {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority: "high" | "medium" | "low"
}

export interface FileEntry {
  path: string
  content: string
  updatedAt: number
  language: string
}

export interface WorkspaceSnapshot {
  id: string
  timestamp: number
  label: string
  messageId?: string
  files: Record<string, string>
}

export interface SessionInfo {
  id: string
  affinityId: string
  projectID: string
  title: string
  createdAt: number
  updatedAt: number
  agentId: string
  providerId: string
  modelId: string
  reasoningEffort: "low" | "medium" | "high" | "xhigh" | "max"
  messages: ChatMessage[]
  todos: TodoItem[]
  snapshots: WorkspaceSnapshot[]
  redoStack: {
    messages: ChatMessage[]
    files: Record<string, string>
    todos: TodoItem[]
  }[]
  compactedCount: number
  parentSessionId?: string
}

export interface McpServerConfig {
  id: string
  name: string
  transport: "http" | "sse" | "stdio"
  urlOrCommand: string
  enabled: boolean
  status: "connected" | "disconnected" | "error"
  tools: {
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }[]
}

export interface SkillItem {
  slug: string
  name: string
  description: string
  path: string
  content: string
}

export interface BrowserTabItem {
  id: number
  title: string
  url: string
  active: boolean
  windowId?: number
  favIconUrl?: string
  selection?: string
  headings?: string[]
  content?: string
}

export interface ThemeDefinition {
  id: string
  name: string
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgElevated: string
  border: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentSecondary: string
  success: string
  warning: string
  danger: string
}

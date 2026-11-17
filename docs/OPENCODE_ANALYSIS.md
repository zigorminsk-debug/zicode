# Полный технический анализ архитектуры OpenCode (`anomalyco/opencode`) и реализация ZiCode (Android + Windows)

## 1. Обзор архитектуры OpenCode (`anomalyco/opencode` v2.3)

**OpenCode** — модульный AI-агент для разработки ПО, построенный по клиент-серверной и плагинной архитектуре на базе TypeScript и функционального рантайма `Effect`. Монорепозиторий OpenCode разделён на ключевые пакеты:

| Пакет OpenCode | Назначение в оригинале | Реализация в ZiCode (Windows & Android) |
|---|---|---|
| `@opencode/core` | Ядро агента: сессии, инструменты (`tool`), агенты (`agent`), провайдеры (`provider`), каталог `models.dev`, снимки (`snapshot`), права (`permission`), MCP, команды (`command`) | `src/core/*` + `server/index.cjs` (Node/Electron) + `ZiCodeNativeBridge` (Android Java) |
| `@opencode/ai` | Протоколы взаимодействия с LLM: `openai-compatible` (`/chat/completions`), `openai/responses` (`/responses`), `anthropic` (`/messages`), `google` (`generateContent`), `system-one` (`decisions`) | `src/core/ai-client.ts` + нативный прокси для обхода CORS на Windows и Android |
| `@opencode/app` & `@opencode/ui` | Графический интерфейс сессий, редактор кода, просмотрщик diff, дерево файлов, терминал, настройки провайдеров | `src/App.tsx` (Dual UI: **Desktop/Mobile Studio GUI** + **Classic Terminal TUI**) |
| `@opencode/desktop` | Десктопная оболочка на базе Electron (`electron-vite` + `electron-builder`) для Windows/macOS/Linux | `electron/main.cjs`, `electron/preload.cjs`, `electron-builder` (NSIS `.exe` + Portable `.exe`) |
| `@opencode/tui` | Классический терминальный интерфейс с переключением агентов `Tab`, палитрой команд `/` и упоминаниями `@file` | Встроенный режим **TUI Mode** (переключение в 1 клик или `Alt+T`) |
| **Android (Новое в ZiCode)** | В оригинальном OpenCode отсутствует нативный Android APK | `android/` — нативный Android Gradle-проект с `ZiCodeNativeBridge` (Java HTTP/SSE без CORS, `/system/bin/sh`, файловая система) и подписью постоянным ключом |

---

## 2. Как устроены бесплатные ИИ-модели в OpenCode (`OpencodePlugin` + `models.dev`)

Один из важнейших механизмов OpenCode находится в файлах:
- `packages/core/src/plugin/provider/opencode.ts`
- `packages/core/src/models-dev.ts`
- `packages/core/src/models-dev/snapshot.txt`
- `packages/core/src/session/model-request.ts`

### 2.1. Автоматическая активация бесплатных моделей (`apiKey: "public"`)
В `packages/core/src/plugin/provider/opencode.ts` при отсутствии пользовательского ключа `OPENCODE_API_KEY` и если не задан флаг `OPENCODE_DISABLE_FREE_MODELS`, OpenCode автоматически включает провайдер `opencode` (OpenCode Zen) с публичным токеном:

```ts
if (!hasKey && !disableFree) {
  provider.activation = "enabled"
  provider.settings = { ...provider.settings, apiKey: "public" }
}
```

Затем фильтр моделей отключает платные модели (`cost.input > 0`) и оставляет активными все модели с нулевой стоимостью (`cost.input === 0` и `cost.output === 0`).

### 2.2. Эндпоинты и заголовки OpenCode Inference Gateway
Бесплатные модели провайдера `opencode` маршрутизируются через три протокола:
1. **OpenAI Chat Completions (`chat-completions`)**:
   - Base URL: `https://opencode.ai/inference/openai/v1` (а также совместимый шлюз `https://opencode.ai/zen/v1`)
   - Заголовок авторизации: `Authorization: Bearer public`
2. **Anthropic Messages (`messages`)**:
   - Base URL: `https://opencode.ai/inference/anthropic/v1`
   - Заголовок авторизации: `x-api-key: public` / `Authorization: Bearer public`
3. **SystemOne Decisions (`systemone`)**:
   - Base URL: `https://opencode.ai/inference/systemone/v1`

При каждом запросе `packages/core/src/session/model-request.ts` передаёт служебные заголовки аффинности сессии:
- `User-Agent: opencode/stable/2.3.0/opencode`
- `x-opencode-session-id: <session.id>`
- `x-session-affinity: <affinity>`
- `X-Session-Id: <affinity>`
- `x-opencode-project: <projectID>`
- `x-opencode-session: <affinity>`
- `x-opencode-client: opencode`

### 2.3. Полный список бесплатных моделей OpenCode (`$0 / Free`), включённых в ZiCode

#### A. Провайдер `opencode` (OpenCode Zen — работают сразу без API-ключа с `apiKey: "public"`)
1. **`big-pickle`** (*Big Pickle*) — 200K контекст, 32K выход, Reasoning + Tool Calling (`chat-completions`)
2. **`beam-free`** (*Beam Free*) — 1M контекст, 131K выход, Reasoning (`low`/`medium`/`high`/`xhigh`/`max`) + Tool Calling
3. **`deepseek-v4.1-flash-free`** (*DeepSeek V4.1 Flash Free*) — 200K контекст, 32K выход, Reasoning toggle & effort + Tool Calling
4. **`glm-5.3-flash-free`** (*GLM-5.3-Flash Free*) — 200K контекст, 32K выход, Reasoning + Tool Calling
5. **`mimo-v2.6-flash-free`** (*MiMo-V2.6-Flash Free*) — 262K контекст, Reasoning + Tool Calling
6. **`flint-40b-free`** (*Flint 40B Free*) — 262K контекст, 65K выход, Reasoning + Tool Calling
7. **`nemotron-3-ultra-free`** (*Nemotron 3 Ultra Free*) — 1M контекст, 128K выход, Reasoning + Tool Calling
8. **`nemotron-3.5-lightning-free`** (*Nemotron 3.5 Lightning Free*) — 262K контекст, 262K выход, Reasoning + Tool Calling
9. **`nemotron-3.5-super-vl-free`** (*Nemotron 3.5 Super VL Free*) — 1M контекст, 131K выход, Vision + Reasoning + Tool Calling
10. **`jev-1.13-free`** (*Jev 1.13 Free*) — 64K контекст, Decision-модель (`systemone`)
11. **Полный архивный/расширенный пул бесплатных моделей OpenCode Zen** (доступен при включении показа всех моделей каталога):
    - `grok-code` (*Grok Code Fast 1 Free*)
    - `glm-4.7-free` (*GLM-4.7 Free*), `glm-5-free` (*GLM-5 Free*)
    - `kimi-k2.5-free` (*Kimi K2.5 Free*)
    - `minimax-m2.1-free`, `minimax-m2.5-free`, `minimax-m3-free`, `minimax-m3.1-flash-free` (*MiniMax Free series*)
    - `qwen3.6-plus-free` (*Qwen3.6 Plus Free*)
    - `deepseek-v4-flash-free` (*DeepSeek V4 Flash Free*)
    - `mimo-v2-flash-free`, `mimo-v2-pro-free`, `mimo-v2-omni-free`, `mimo-v2.5-free`
    - `trinity-large-preview-free` (*Trinity Large Preview*)
    - `nemotron-3-super-free` (*Nemotron 3 Super Free*)
    - `hy3-free`, `hy3-preview-free` (*Tencent Hy3 Free*)
    - `ring-2.6-1t-free` (*Ring 2.6 1T Free*)
    - `ling-2.6-flash-free`, `ling-3.0-flash-free`, `ling-3.0-tiny-free`, `ling-3.1-flash-free`
    - `longcat-2.0-free`, `longcat-2.5-preview-free`
    - `north-mini-code-free` (*North Mini Code Free*)
    - `x-preview-f-free` (*Ox Alpha Free Unlimited*), `space-bunny-free`, `step-5-preview-free`, `cat-jam-free`

#### B. Динамическая синхронизация с `models.dev` + бесплатные модели других провайдеров OpenCode
Как и в `packages/core/src/models-dev.ts`, ZiCode синхронизирует каталог с `https://models.dev/api/v2/catalog.json` (и `https://models.dev/api.json`) и включает бесплатные модели ($0 input / $0 output):
- **OpenRouter (`openrouter`)**: `openrouter/free` (Free Router), `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-lightning:free`, `nvidia/nemotron-3.5-super-vl:free`, `cohere/north-mini-code:free`, `recursive/flint-v1.0:free`, `thinkingmachines/inkling:free`, `liquid/lfm-2.5-2.6b:free`
- **Z.AI / Zhipu AI (`zai`, `zhipuai`)**: `glm-4.7-flash`, `glm-4.6v-flash`, `glm-4.5-flash`
- **Google Gemini (`google`)**: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.5-flash`
- **Groq (`groq`)**, **Nvidia NIM (`nvidia`)**, **Cerebras (`cerebras`)**, **Vercel AI Gateway (`vercel`)**, **AIHubMix (`aihubmix`)**, **Ollama / LM Studio / Local (`ollama`, `lmstudio`)**

---

## 3. Агенты, Инструменты и Команды (100% функциональный паритет)

### 3.1. Встроенные агенты (`packages/core/src/plugin/agent.ts` & `plan.ts`)
1. **`build` (Primary)** — агент по умолчанию с полным доступом к чтению/записи/редактированию файлов, патчам, терминалу, вебу и сабагентам.
2. **`plan` (Primary, Read-Only)** — агент планирования и анализа архитектуры. Переключается клавишей `Tab`. При входе в режим `plan` внедряется директива `<system-reminder>`, запрещающая модификацию файлов проекта (кроме `.opencode/plan/*`) до возврата в `build`.
3. **`general` (`@general` Subagent)** — автономный сабагент для многошаговых задач и параллельных исследований.
4. **`explore` (`@explore` Subagent)** — быстрый сабагент навигации по кодовой базе (`quick`, `medium`, `very thorough`).
5. **`compaction` (Hidden)** — агент сжатия контекста при заполнении окна токенов или по команде `/compact`.
6. **`title` & `summary` (Hidden)** — автогенерация заголовка сессии и PR-резюме изменений.

### 3.2. Все 17 встроенных инструментов (`packages/core/src/tool/plugin/*`)
- `read` — чтение файлов с нумерацией строк (`offset`, `limit`) и просмотр директорий.
- `write` — создание и перезапись файлов с фиксацией в Snapshot.
- `edit` — точная и умная замена `oldString` -> `newString` (`replaceAll`) с генерацией unified diff.
- `patch` — применение многофайловых патчей (`*** Begin Patch`, `*** Add/Update/Delete File`).
- `bash` (`shell`) — выполнение команд ОС (`PowerShell`/`CMD`/`Bash` на Windows, `/system/bin/sh` + виртуальный шелл на Android).
- `glob` — поиск файлов по glob-шаблонам (`**/*.ts` и т.д.).
- `grep` — регулярный поиск по содержимому файлов проекта с номерами строк.
- `webfetch` — загрузка веб-страниц и документации с конвертацией HTML -> Markdown.
- `websearch` — поиск актуальной информации в интернете.
- `todowrite` / `todoread` — управление списком задач сессии с приоритетами и статусами.
- `task` (`subagent`) — запуск сабагентов `general` и `explore`.
- `question` — интерактивный опрос пользователя с вариантами ответа.
- `skill` — загрузка специализированных навыков (`SKILL.md`).
- `lsp_diagnostics` — статический анализ, проверка синтаксиса и символов кода.
- `mcp_call` / `mcp_resource` — вызов инструментов и ресурсов подключённых MCP-серверов.
- `artifact` — создание интерактивных артефактов (HTML/SVG/Mermaid/Code).

### 3.3. Все слэш-команды и горячие клавиши
- `/init` — генерация/обновление `AGENTS.md` по стандарту OpenCode.
- `/review` — ревью незакоммиченных изменений, ветки или коммита.
- `/undo` и `/redo` — откат и возврат шагов сессии вместе с изменениями файлов (через Snapshot Engine).
- `/compact` — сжатие истории диалога.
- `/models` — выбор модели с фильтром бесплатных моделей (`FREE $0`) и синхронизацией `models.dev`.
- `/agent` (или `Tab`) — переключение `Build` <-> `Plan` <-> `Explore` <-> `General`.
- `/themes` — 14 тем оформления OpenCode (`opencode`, `tokyonight`, `catppuccin`, `dracula`, `gruvbox`, `nord` и др.).
- `/sessions`, `/new`, `/diff`, `/mcp`, `/status`, `/cost`, `/share`, `/export`, `/terminal`, `/help`.
- `@filename` — автодополнение и прикрепление файлов проекта в промпт.
- `!command` — мгновенное выполнение shell-команды из строки ввода.

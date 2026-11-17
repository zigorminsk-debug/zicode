# ZiCode — Аналог OpenCode (v2.7.0) для Android и Windows

> **ZiCode** — кроссплатформенный AI-агент для программирования под **Android (Signed Release `.apk`)** и **Windows (`.exe` NSIS Installer & Portable)**, повторяющий 100% функционала [OpenCode (`anomalyco/opencode`)](https://github.com/anomalyco/opencode) и поддерживающий весь пул бесплатных ИИ-моделей OpenCode Zen и каталога `models.dev`.

---

## 1. Ключевые возможности (100% паритет с OpenCode)

- **Бесплатные ИИ-модели из коробки (`$0 / Free`, `apiKey: "public"`)**:
  - **OpenCode Zen (`opencode`)**:
    - `big-pickle` (*Big Pickle* — 200K контекст, 32K выход, Reasoning + Tools)
    - `beam-free` (*Beam Free* — 1 048 576 токенов контекста, 131K выход, 5 уровней Reasoning + Tools)
    - `deepseek-v4.1-flash-free` (*DeepSeek V4.1 Flash Free* — 200K контекст, Reasoning + Tools)
    - `glm-5.3-flash-free` (*GLM-5.3-Flash Free* — 200K контекст, Reasoning + Tools)
    - `mimo-v2.6-flash-free` (*MiMo-V2.6-Flash Free* — 262K контекст, strict Tool Calling)
    - `flint-40b-free` (*Flint 40B Free* — 262K контекст, Reasoning + Tools)
    - `nemotron-3-ultra-free` (*Nemotron 3 Ultra Free* — 1M контекст, 128K выход)
    - `nemotron-3.5-lightning-free` (*Nemotron 3.5 Lightning Free* — 262K контекст/выход)
    - `nemotron-3.5-super-vl-free` (*Nemotron 3.5 Super VL Free* — 1M контекст, Vision + Reasoning + Tools)
    - `jev-1.13-free` (*Jev 1.13 Free* — SystemOne Decision)
    - Полный каталог бесплатных моделей OpenCode Zen: `grok-code`, `glm-5-free`, `glm-4.7-free`, `kimi-k2.5-free`, `minimax-m3.1-flash-free`, `minimax-m3-free`, `minimax-m2.5-free`, `qwen3.6-plus-free`, `deepseek-v4-flash-free`, `mimo-v2-pro-free`, `trinity-large-preview-free`, `nemotron-3-super-free`, `north-mini-code-free`, `hy3-free`, `ring-2.6-1t-free`, `ling-3.1-flash-free`, `longcat-2.5-preview-free`, `laguna-s-2.1-free`, `x-preview-f-free`.
  - **Динамическая синхронизация с `https://models.dev/api/v2/catalog.json`** и бесплатные модели других провайдеров:
    - **OpenRouter (`openrouter`)**: `openrouter/free`, `cohere/north-mini-code:free`, `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-lightning:free`, `nvidia/nemotron-3.5-super-vl:free`, `recursive/flint-v1.0:free`, `thinkingmachines/inkling:free`, `liquid/lfm-2.5-2.6b:free`
    - **Z.AI / Zhipu AI (`zai`)**: `glm-4.7-flash`, `glm-4.6v-flash`, `glm-4.5-flash`
    - **Google Gemini Free Tier**, **NVIDIA NIM Free**, **Groq Free Tier**, **Alibaba Token Plan**, **AIHubMix Free**, **Vercel AI Gateway Free**, **Ollama / LM Studio Local**
- **Встроенные агенты (`Tab` переключение)**:
  - `Build` — полный доступ к редактированию файлов и терминалу
  - `Plan` — режим проектирования и анализа только для чтения (с автоматической вставкой `<system-reminder>`)
  - `@general` и `@explore` — сабагенты для многошаговых задач и быстрого поиска по коду
  - `Compaction`, `Title`, `Summary` — системные агенты управления контекстом и заголовками сессий
- **Все 17 инструментов OpenCode**:
  - `read`, `write`, `edit`, `patch`, `bash`, `glob`, `grep`, `todowrite`, `todoread`, `webfetch`, `websearch`, `task`, `question`, `skill`, `lsp_diagnostics`, `mcp_call`, `artifact`
- **Все слэш-команды и режимы интерфейса**:
  - `/init`, `/review`, `/models`, `/agent`, `/undo`, `/redo`, `/compact`, `/diff`, `/new`, `/sessions`, `/themes`, `/mcp`, `/terminal`, `/status`, `/export`, `/help`
  - Двойной интерфейс: **Studio GUI** (OpenCode Desktop 2.0) + **Classic TUI Mode** (OpenCode Terminal UI)

- **🐙 Кнопка «Работа с репозиториями GitHub» прямо в чате**:
  - Открывает список ваших репозиториев (по Personal Access Token) и готовые сценарии:
    **📖 Анализ README**, **🧭 Полный анализ кода**, **✍️ Дописать код**, **🐞 Исправить ошибки**,
    **🚀 Сборка в GitHub Actions** (запуск `Run workflow`, статусы запусков, генерация `.github/workflows/build.yml`).
  - Кнопка **«💬 Просто чат»** выключает режим репозитория — агент выполняет локальные задачи и **не обращается к браузеру**.
- **Браузер только по явной просьбе**: вкладки Chrome, почта (Kerio Connect / Gmail / Yandex) и веб-страницы
  читаются **только** если вы сами попросили («прочитай вкладку», «покажи письма»). При задачах по коду/README
  инструмент `browser_tabs` заблокирован, а расширение Chrome Bridge больше не сканирует страницы в фоне —
  глубокое чтение выполняется один раз по запросу.

---

## 2. Сборка в GitHub Actions и постоянный ключ Android

Сборка для **Android** и **Windows** автоматически запускается в GitHub Actions (`.github/workflows/build.yml`):
1. **`Build & Sign Android Release APK` (`ubuntu-latest`)**:
   - Собирает веб-ядро ZiCode и синхронизирует ассеты в `android/app/src/main/assets/www`
   - Подписывает APK постоянным релизным ключом PKCS#12 (`zicode-key`, схемы V1 + V2 + V3) из GitHub Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)
   - Публикует артефакт `ZiCode-Android-Signed-APK` (`ZiCode-Android-v2.7.0-Signed-Release.apk`)
2. **`Build Windows Desktop (.exe Installer & Portable)` (`windows-latest`)**:
   - Собирает Windows-приложение через `electron-builder --win --x64`
   - Публикует артефакт `ZiCode-Windows-x64` (`ZiCode-Setup-2.7.0-x64.exe`, `ZiCode-Portable-2.7.0-x64.exe`, `.zip`)

Подробное описание архитектуры OpenCode находится в [`docs/OPENCODE_ANALYSIS.md`](docs/OPENCODE_ANALYSIS.md), а параметры постоянного ключа подписи Android и секретов GitHub — в [`SIGNING.md`](SIGNING.md).

---

*Примечание: ZiCode — независимый проект с открытым исходным кодом, построенный на базе архитектуры OpenCode, и не аффилирован с командой OpenCode.*

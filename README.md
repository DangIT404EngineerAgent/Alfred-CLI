# 🤖 Agentic Terminal AI (Quản gia AI)

A modern, terminal-based AI assistant built with **React (Ink)**. It acts as an autonomous agent capable of **executing shell commands, reading, and modifying files** directly within your workspace via **OpenRouter**. Install once and use the `quangiaai` command anywhere — just like the `claude` CLI.

> 🎓 Graduation Project · Defaults to the free `moonshotai/kimi-k2.6:free` model via OpenRouter.

*[Đọc bản Tiếng Việt tại đây](./README.vi.md)*

---

## ✨ Features

- 💬 **Real-time Chat Streaming** — Watch responses type out instantly.
- 🎨 **Rich Terminal UI** — Full Markdown support with syntax highlighting (`marked-terminal`).
- 🛠️ **Advanced Agentic Tooling** — The AI can autonomously use tools to accomplish tasks:
  - `runShell` — Execute bash/powershell commands.
  - `readFile` — Read file contents (with smart truncation for large files > 50KB).
  - `writeFile` — Create or overwrite files.
  - `replaceInFile` — Surgically replace specific text blocks in large files without rewriting everything.
  - `searchProject` — Grep-like functionality to search for keywords across the entire codebase.
- 🛡️ **Interactive Approvals (Y/N)** — AI must ask for permission before modifying files or running commands.
- 📎 **Smart File Attachments (`@`)** — Type `@` to open an interactive file picker. Automatically respects `.gitignore` and ignores hidden/build directories.
- 🧠 **Context Management** — Implements a Sliding Window (keeps the last 20 messages) to prevent Token Length Exceeded errors.
- 🛑 **Graceful Interrupts** — Press `Ctrl+C` while the AI is streaming to safely abort the request without crashing the app.
- ⚡ **Instant Startup** — Bundled via `tsup` into a single lightweight JavaScript file for blazing-fast execution.
- 🌍 **Global CLI** — Access `quangiaai` from any directory. Configurations are saved globally in `~/.terminalai`.

---

## 📋 Requirements

- **Node.js ≥ 18** (20+ recommended). Check with: `node -v`
- An **[OpenRouter API Key](https://openrouter.ai/keys)** (starts with `sk-or-v1-...`).
- A true terminal environment (cmd / PowerShell / Git Bash / Windows Terminal).

---

## 🚀 Installation

### 1. Clone & Install Dependencies
```bash
cd /path/to/TerminalAI
npm install
```

### 2. Build the CLI
```bash
npm run build
```

### 3. Link Globally
```bash
npm link
```
Now, open a **new terminal** in any directory and type:
```bash
quangiaai
```

---

## 🔑 API Key Configuration

There are **3 ways** to set your API key (in order of priority):

1. **In-App (Recommended):** Run `quangiaai` and either:
   - Press **Ctrl+S** → `[K]` → paste key → Enter.
   - Or type the command: `/key sk-or-v1-xxxxx`
   - *(Saved globally to `~/.terminalai/config.json`)*
2. **`.env` File** (Local project only): Copy `.env.example` to `.env` and fill it out.
3. **System Environment Variables.**

---

## ⌨️ Usage

Simply type your questions or tasks. The AI will proactively use its tools if needed.

**Slash Commands:**
| Command | Description |
|---|---|
| `/help` | Show command list |
| `/models` | Open live OpenRouter model picker |
| `/model <id>` | Quick switch to a specific model |
| `/key <api-key>` | Set your API key |
| `/settings` | Open settings panel |
| `exit` | Quit the application |

**Shortcuts:**
- `Ctrl+S` — Open/close settings panel. (`[M]` change model · `[K]` enter key · `[Esc]` close).
- `Ctrl+C` — Abort AI response or exit.
- `@` — Type `@` to search and attach local files to your prompt.

> **Try it out:** *"Find where `handleSubmit` is declared using searchProject, then use replaceInFile to add a console.log at the top of it."*

---

## 🧱 Tech Stack

- **[Ink](https://github.com/vadimdemedes/ink):** React for interactive CLI apps.
- **[Vercel AI SDK](https://sdk.vercel.ai):** Streaming and Tool Calling orchestration.
- **[tsup](https://tsup.egoist.dev/):** Lightning-fast TypeScript bundler.
- **[ignore](https://www.npmjs.com/package/ignore):** `.gitignore` parser for smart file scanning.
- **[ink-spinner](https://www.npmjs.com/package/ink-spinner):** Animated loading states.

---

## 🩺 Troubleshooting

- `⚠️ Error (429)`: Free models on OpenRouter are rate-limited. Wait a minute, switch to a different model (`/models`), or add credits to your account.
- `quangiaai: command not found`: Re-run `npm link`. Ensure your npm global bin folder is in your system PATH.
- `Raw mode is not supported`: You are running in a non-TTY environment (like a CI pipeline or pipe). Use a standard terminal.

## 🧹 Uninstall

```bash
npm unlink -g terminal-ai
```
*(If you move or delete the project folder, the global command will break until you `npm link` again).*

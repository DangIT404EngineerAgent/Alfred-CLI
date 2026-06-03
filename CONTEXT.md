# CONTEXT.md — Ngữ cảnh dự án (đọc trước khi làm)

> File này dành cho **AI/dev mới** đọc để nắm toàn bộ bối cảnh dự án mà không cần giải thích lại.
> Cập nhật file này khi có thay đổi lớn về kiến trúc/quyết định.

---

## 1. Dự án là gì

**Agentic Terminal AI** ("Quản gia AI") — một CLI trợ lý AI chạy trên terminal, giao diện bằng **React (Ink)**, có khả năng **tự chạy shell / đọc / ghi / sửa file** (agentic), giống `claude` CLI. Đây là **đồ án tốt nghiệp**.

- Người dùng tự xưng **"Cậu chủ Đăng"**, AI đóng vai **"Quản gia AI"**. Giao tiếp bằng **tiếng Việt**.
- Provider: **OpenRouter** (`https://openrouter.ai/api/v1`), OpenAI-compatible.
- Model mặc định: **`moonshotai/kimi-k2.6:free`** (miễn phí). API key dạng `sk-or-v1-...`.

---

## 2. Trạng thái hiện tại (đã hoàn thành)

- ✅ **Phase 1** — Chat streaming cơ bản (Ink + AI SDK).
- ✅ **Phase 2** — Tool calling cơ bản (`runShell`, `readFile`, `writeFile`) + hỏi **Y/N** trước khi chạy/ghi.
- ✅ **Cài đặt linh hoạt** — slash command (`/key`, `/model`, `/models`, `/settings`, `/help`, `/undo`) + bảng **Ctrl+S** + **picker chọn model live** từ OpenRouter (lọc/↑↓/Enter).
- ✅ **Nâng cấp UI** — `<Static>` (hết nhấp nháy), **Markdown + tô màu code** (marked-terminal), spinner, hiển thị **tool call live** (✓/⏳).
- ✅ **Phase 3** — (1) **Gắn file bằng `@`**: gõ `@` hiện danh sách file (quét đệ quy, tôn trọng `.gitignore` + bỏ `node_modules`/`dist`/thư mục ẩn…), `↑↓` chọn, **Enter** = chèn `@path` + nhúng nội dung file vào ngữ cảnh, **Tab** = chỉ gắn thẻ `@path` để AI tự `readFile`. (2) **UI**: nhãn "👨‍💻 Cậu chủ" tách dòng riêng, ô nhập xuống dòng (`❯`). (3) **Bền bỉ**: retry/backoff khi lỗi mạng/429 (4 lần), `maxSteps` **25**, tự nhắc "tiếp tục" khi bị cắt (`finishReason === 'length'`, 3 lần).
- ✅ **Phase 4 — Agentic toàn diện & an toàn**:
  - **9 công cụ**: `runShell` (interactive qua **node-pty**), `readFile`, `writeFile`, `replaceInFile` (search & replace có **diff preview**), `listDirectory`, `createDirectory`, `deleteFile`, `getFileMetadata`, `searchProject` (grep toàn project, tôn trọng `.gitignore`).
  - **An toàn**: blocklist lệnh phá hoại (`rm -rf /`, `mkfs`, `dd`…) và **cấm đọc `.env`**; **backup tự động** trước khi ghi/sửa/xóa + lệnh **`/undo`** (`restoreLatestBackup`, stack ở `~/.terminalai/backups`); **validate `npm run typecheck`** sau khi ghi/sửa → **auto-rollback** nếu lỗi cú pháp.
  - **Phê duyệt theo lô (batch approval)**: gộp nhiều hành động trong một lượt (debounce 50ms) → **một** lần bấm **Y/N** duyệt tất cả.
  - **Quản lý ngữ cảnh**: cắt lịch sử theo **token thật** (`js-tiktoken` cl100k_base, ngân sách **120k token**); tự nạp file hướng dẫn dự án (`.quangiaairc`, `.cursorrules`, `.ai-instructions.md`, `CLAUDE.md`) vào system prompt; **prompt caching** (`experimental_providerMetadata.anthropic.cacheControl: ephemeral`).
  - **Dự phòng khi 429**: sau 2 lần dính 429 → tự đổi sang model free khác (`gemini-2.5-flash:free` → `llama-3.3-70b:free` → `mistral-7b:free`).
  - **Khác**: `Ctrl+C` huỷ request đang chạy; ghi lỗi ra `~/.terminalai/error.log`; cắt file đọc > 50KB.
- ✅ **Tối ưu theo modalities từng model** — đọc capability từ OpenRouter `/models` (`architecture.input_modalities` + `supported_parameters`, không cần key) cho model đang dùng:
  - **Gate tools**: chỉ gửi `tools` khi model có `"tools"` trong `supported_parameters` → tránh lỗi *"No endpoints found that support tool use"* với model không hỗ trợ function calling. System prompt cũng đổi theo (không "khoe" công cụ khi model không hỗ trợ).
  - **Ảnh đúng định dạng**: đính kèm file ảnh (`.png/.jpg/.jpeg/.gif/.webp/.bmp`) → gửi dạng **image part** nếu model nhận ảnh; nếu không → cảnh báo & bỏ qua, **không** đọc nhị phân bằng `utf8` (tránh text rác). File text vẫn nhúng utf8 như cũ.
  - **UI**: dòng trạng thái dưới ô nhập hiện badge khả năng (`📝 text · 🖼️ image · 🔧 tools`).
  - Lấy bằng `fetchModelCapabilities(baseURL, modelId)` (openrouter.ts); fetch lỗi/model lạ → `DEFAULT_CAPABILITIES` (tools **bật**, ảnh **tắt**) để giữ hành vi agentic. Model dự phòng khi 429 vẫn dùng cờ tools của model gốc.
- ✅ **Modular hóa** — tách `index.tsx` thành `components/`, `hooks/`, `tools/`, `utils/`.
- ✅ **CLI toàn cục** — lệnh **`quangiaai`**; build bằng **tsup** → `dist/cli.js`; cấu hình lưu ở `~/.terminalai/config.json`.
- ✅ **Test (vitest)** — `config.test.ts`, `openrouter.test.ts`.
- ✅ **README.md** (+ `README.vi.md`) — hướng dẫn đầy đủ cho người mới.

---

## 3. Stack & quyết định kỹ thuật QUAN TRỌNG (đừng vô tình phá)

- **Vercel AI SDK PIN bản v4** (`ai@^4`, `@ai-sdk/openai@^1`). KHÔNG nâng lên v5 — v5 đổi API (`CoreMessage`→`ModelMessage`, provider mặc định dùng Responses API mà OpenRouter không hỗ trợ).
- **Provider:** `createOpenAI({ apiKey, baseURL, compatibility: 'compatible' })` rồi `provider(modelId)`. Dùng `compatibility:'compatible'` cho provider bên thứ ba.
- **Ink v5 + React 18 + ink-text-input v6 + ink-spinner v5** (tương thích nhau).
- **tsx** chạy TSX trực tiếp khi dev (`npm start`, không cần build). **tsup** dùng để **build** ra `dist/cli.js` cho lệnh global. `tsx` nằm ở **devDependencies**; bản build (`dist/cli.js`) đã bundle nên `npm install -g` chạy được mà không cần tsx.
- **`cli.ts`** = entry của lệnh global: shebang `#!/usr/bin/env node` + `import './index.tsx'`. `package.json#bin.quangiaai` trỏ tới **`./dist/cli.js`** (đã build).
- **`config.ts` là async** — `loadConfig()`/`saveConfig()` trả `Promise` (dùng `fs/promises`). Nơi gọi phải `await`.
- **node-pty** cho `runShell` interactive (TTY giả) — chạy được lệnh hỏi-đáp; tự chọn shell theo OS (`cmd.exe`/`COMSPEC` trên Windows, `$SHELL`/`bash` trên Unix).
- **Markdown:** `marked.use(markedTerminal({width, reflowText}))` trong `utils/format.ts`; chỉ render markdown cho tin **assistant đã hoàn tất** (streaming để text thô). Có `marked-terminal.d.ts` khai báo type thủ công.

---

## 4. Cấu trúc file

```
TerminalAI/
├── cli.ts               # entry lệnh global (shebang + import './index.tsx'); build → dist/cli.js
├── index.tsx            # App Ink gốc: state mode, routing slash command, approval UI, picker model
├── config.ts            # loadConfig/saveConfig (ASYNC) tại ~/.terminalai/config.json (fallback .env → mặc định)
├── openrouter.ts        # fetchModels(baseURL): tải danh sách model live (/models, không cần key)
│                        # + fetchModelCapabilities(baseURL, modelId): modalities & tools của 1 model
├── components/
│   ├── MessageView.tsx  # render 1 message (+ type Item); markdown cho assistant
│   ├── ChatInput.tsx    # ô nhập + popup gắn file @ + dòng trạng thái model
│   └── Settings.tsx      # bảng cài đặt (Ctrl+S) + form nhập API key
├── hooks/
│   ├── useChat.ts       # LÕI: streamText, tools, retry/backoff, fallback 429, batch approval,
│   │                    #      token budgeting, prompt caching, system prompt (persona);
│   │                    #      nhận ModelCapabilities → gate tools + gửi ảnh theo khả năng model
│   └── useFilePicker.ts # logic gõ '@' để gắn file (scan, lọc, chọn inline/thẻ)
├── tools/
│   └── index.ts         # createTools(...) = 9 tool; backup/restore (/undo); validate+rollback
├── utils/
│   ├── format.ts        # renderMarkdown, maskKey
│   ├── fs.ts            # scanFiles(root): quét file tôn trọng .gitignore (gói 'ignore')
│   └── logger.ts        # logError → ~/.terminalai/error.log
├── marked-terminal.d.ts # khai báo type cho marked-terminal
├── config.test.ts       # test vitest cho config
├── openrouter.test.ts   # test vitest cho fetchModels
├── tsup.config.ts       # cấu hình build (entry cli.ts, esm, minify, → dist/)
├── package.json         # "bin": { "quangiaai": "./dist/cli.js" }; scripts: start/build/test/typecheck
├── tsconfig.json        # jsx: react-jsx, module ESNext, moduleResolution bundler, noEmit
├── .env                 # env cục bộ (OPENAI_API_KEY / OPENAI_BASE_URL / MODEL_ID)
├── .gitignore           # node_modules, .env, config.json, coverage
├── CLAUDE.md            # quy tắc làm việc (xem mục 6)
├── README.md / README.vi.md  # hướng dẫn người dùng
└── CONTEXT.md           # file này
```

Tạo tự động NGOÀI repo (ở `~/.terminalai/`): `config.json` (`{ apiKey, baseURL, model }`), `backups/` (+ `latest_backup.json`), `error.log`.

---

## 5. Kiến trúc & luồng (tóm tắt)

- **`index.tsx`** giữ UI + state `mode` (`'chat' | 'settings' | 'editKey' | 'picker'`) và route slash command:
  - Lệnh `/...` → xử lý cục bộ (đổi key/model, mở settings/picker, `/undo`), KHÔNG gọi API.
  - Chat thường → gọi `submitChat()` của hook `useChat`.
- **`useChat`** (lõi): build messages → `streamText({ model: provider(cfg.model), messages, tools, maxSteps: 25, abortSignal })`, đọc `result.fullStream` để cập nhật `streamTextState`/`activeTools`. Bọc trong `callWithRetry` (retry/backoff + fallback 429) và vòng `continue` khi `finishReason === 'length'`.
- **Tool calling + approval:** `tools/index.ts#createTools(requestApproval, onToolStatus)`. Tool `execute` gọi `requestApproval(title, detail, data?)` → trả `Promise<boolean>`. Hook gom các yêu cầu vào hàng đợi (debounce 50ms) thành **một batch** `pendingApproval`; `useInput` bắt **Y/N** rồi `resolveAll`. `readFile`/`listDirectory`/`searchProject`/`getFileMetadata` KHÔNG cần duyệt (chỉ đọc).
- **Diff preview:** `replaceInFile` đính `data: { type: 'diff', searchBlock, replaceBlock }` để UI hiển thị `-/+` màu.
- **An toàn ghi file:** trước khi ghi/sửa/xóa → `backupPathObj` (copy vào `~/.terminalai/backups`, push lên stack). Sau khi ghi/sửa → `validateProjectSyntax()` (`npm run typecheck`); nếu lỗi → **rollback** về nội dung cũ.
- **Lịch sử** dùng `Item { id, role: user|assistant|system, content, attachments? }`. Khi build messages chỉ lấy `role === user|assistant`; cắt theo **token** (js-tiktoken, 120k). System prompt + tin cuối gắn cacheControl ephemeral.
- **`<Static items={items}>`** in lịch sử một lần; streaming, tool status, approval, input nằm ngoài Static.

---

## 6. Quy tắc làm việc (theo CLAUDE.md — phải tuân thủ)

1. **Nghĩ trước khi code** — nêu giả định, hỏi khi mơ hồ, trình bày các lựa chọn thay vì tự quyết im lặng.
2. **Đơn giản trước** — code tối thiểu, không thêm tính năng/abstraction/cấu hình ngoài yêu cầu.
3. **Sửa đúng phạm vi** — chỉ đụng thứ cần đụng; không "cải thiện" code lân cận; theo style hiện có; chỉ dọn rác do chính mình tạo.
4. **Có tiêu chí kiểm chứng** — biến nhiệm vụ thành mục tiêu verify được; lặp tới khi đạt.
- Tài liệu/giao tiếp với người dùng: **tiếng Việt**.
- Dữ liệu web: ưu tiên `WebFetch` → `agent-browser CLI`. PDF dùng `pdftotext`.

---

## 7. Cạm bẫy đã biết (GOTCHAS)

- ⚠️ **Model `:free` hay trả HTTP 429** ("rate-limited upstream") — giới hạn tier free của OpenRouter, **KHÔNG phải lỗi code**. Đã có cơ chế retry + fallback sang model free khác. Khắc phục: thử lại, đổi model, hoặc thêm key BYOK.
- ⚠️ **Ink cần TTY thật.** Chạy qua pipe / `< /dev/null` thì Ink render một lần rồi thoát — bình thường, không phải bug. Không test được chat tương tác trong môi trường không-TTY.
- ⚠️ **`streamText` nuốt lỗi** (textStream/fullStream im lặng khi provider lỗi); muốn debug lỗi thật thì dùng `generateText` hoặc gọi raw `fetch` tới `/chat/completions` để xem body. Lỗi cũng được ghi vào `~/.terminalai/error.log`.
- ⚠️ **`config.ts` async** — quên `await loadConfig()`/`saveConfig()` sẽ nhận về `Promise` thay vì giá trị.
- ⚠️ **`validateProjectSyntax` chạy `npm run typecheck`** sau mỗi lần ghi/sửa file → chậm và sẽ **rollback** nếu repo đang có lỗi TS sẵn (kể cả lỗi không liên quan tới file vừa sửa). Lưu ý khi repo đang ở trạng thái không typecheck-sạch.
- ⚠️ **node-pty là native module** — cần build tool (node-gyp) khi cài; lỗi cài đặt thường do thiếu toolchain, không phải lỗi code.
- ⚠️ **Ctrl+S** có thể là XOFF (flow control) ở vài terminal, nhưng Ink bật raw mode nên thường nhận được như phím thường.
- ⚠️ Sau khi **đổi code lệnh global**, phải **build lại** (`npm run build`) vì `bin` trỏ tới `dist/cli.js` (bản bundle), không phải source. Di chuyển/xoá thư mục dự án cũng làm hỏng `npm link` → link lại.

---

## 8. Lệnh kiểm chứng nhanh

```bash
npm run typecheck                  # tsc --noEmit  → phải EXIT 0
npm test                           # vitest run (config + openrouter)
npm start                          # chạy app dev (tsx index.tsx — cần terminal thật)
npm run build                      # tsup → dist/cli.js (cho lệnh global)
which quangiaai                    # kiểm tra lệnh toàn cục đã link
```

> Khi gọi live model để test, nhớ có thể dính 429 (xem mục 7). Endpoint `/models` thì public, không dính 429.

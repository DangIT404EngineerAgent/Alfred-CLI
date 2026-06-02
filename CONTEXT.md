# CONTEXT.md — Ngữ cảnh dự án (đọc trước khi làm)

> File này dành cho **AI/dev mới** đọc để nắm toàn bộ bối cảnh dự án mà không cần giải thích lại.
> Cập nhật file này khi có thay đổi lớn về kiến trúc/quyết định.

---

## 1. Dự án là gì

**Agentic Terminal AI** ("Quản gia AI") — một CLI trợ lý AI chạy trên terminal, giao diện bằng **React (Ink)**, có khả năng **tự chạy shell / đọc / ghi file** (agentic), giống `claude` CLI. Đây là **đồ án tốt nghiệp**.

- Người dùng tự xưng **"Cậu chủ Đăng"**, AI đóng vai **"Quản gia AI"**. Giao tiếp bằng **tiếng Việt**.
- Provider: **OpenRouter** (`https://openrouter.ai/api/v1`), OpenAI-compatible.
- Model mặc định: **`moonshotai/kimi-k2.6:free`** (miễn phí). API key dạng `sk-or-v1-...`.

---

## 2. Trạng thái hiện tại (đã hoàn thành)

- ✅ **Phase 1** — Chat streaming cơ bản (Ink + AI SDK).
- ✅ **Phase 2** — Tool calling: `runShell`, `readFile`, `writeFile` + hỏi **Y/N** trước khi chạy/ghi.
- ✅ **Cài đặt linh hoạt** — slash command (`/key`, `/model`, `/models`, `/settings`, `/help`) + bảng **Ctrl+S** + **picker chọn model live** từ OpenRouter (lọc/↑↓/Enter).
- ✅ **Nâng cấp UI** — `<Static>` (hết nhấp nháy), **Markdown + tô màu code** (marked-terminal). Sửa bug `exit` thiếu `return`, bỏ `width={120}` cứng.
- ✅ **CLI toàn cục** — lệnh **`quangiaai`** qua `npm link`; cấu hình lưu ở `~/.terminalai/config.json`.
- ✅ **README.md** — hướng dẫn đầy đủ cho người mới.
- ✅ **Phase 3** — (1) **Gắn file bằng `@`**: gõ `@` hiện danh sách file (quét đệ quy, bỏ `node_modules`/`.git`/thư mục ẩn/`dist`…), `↑↓` chọn, **Enter** = chèn `@path` + nhúng nội dung file vào ngữ cảnh, **Tab** = chỉ gắn thẻ `@path` để AI tự `readFile`. (2) **Sửa UI**: nhãn "👨‍💻 Cậu chủ" tách riêng một dòng, ô nhập xuống dòng dưới (`❯`) — hết lỗi cắt chữ "Cậu ch". (3) **Bền bỉ**: gọi model có **retry/backoff** khi lỗi mạng/429/AI im lặng (tối đa 4 lần), `maxSteps` 6→**25**, và **tự nhắc "tiếp tục"** khi AI bị cắt giữa chừng (`finishReason === 'length'`, tối đa 3 lần).

---

## 3. Stack & quyết định kỹ thuật QUAN TRỌNG (đừng vô tình phá)

- **Vercel AI SDK PIN bản v4** (`ai@^4`, `@ai-sdk/openai@^1`). KHÔNG nâng lên v5 — v5 đổi API (`CoreMessage`→`ModelMessage`, provider mặc định dùng Responses API mà OpenRouter không hỗ trợ).
- **Provider:** `createOpenAI({ apiKey, baseURL, compatibility: 'compatible' })` rồi `provider(modelId)`. Dùng `compatibility:'compatible'` cho provider bên thứ ba.
- **Ink v5 + React 18 + ink-text-input v6** (tương thích nhau).
- **tsx** chạy TSX trực tiếp (không build). `tsx` nằm ở **dependencies** (để `npm install -g` cũng chạy được).
- **`import React`** BẮT BUỘC ở đầu `index.tsx` — vì `cli.mjs` dùng `tsImport` (JSX classic runtime), thiếu sẽ lỗi `React is not defined`. (Còn `tsx` CLI thì đọc tsconfig `react-jsx` nên không cần — nhưng cứ giữ import cho chắc.)
- **`cli.mjs`** dùng `tsImport('./index.tsx', import.meta.url)` — specifier **tương đối** (đường dẫn tuyệt đối Windows `D:\` bị hiểu nhầm thành URL scheme `d:`).
- **Markdown:** `marked.use(markedTerminal({width, reflowText}))`; chỉ render markdown cho tin **assistant đã hoàn tất** (streaming thì để text thô). Có `marked-terminal.d.ts` khai báo type thủ công.

---

## 4. Cấu trúc file

```
TerminalAI/
├── cli.mjs              # bin của lệnh `quangiaai` (shebang + tsImport chạy index.tsx)
├── index.tsx           # TOÀN BỘ app Ink: chat, tool calling, settings, picker, approval Y/N
├── config.ts           # load/save cấu hình tại ~/.terminalai/config.json (fallback .env → mặc định)
├── openrouter.ts       # fetchModels(baseURL): tải danh sách model live (endpoint /models, không cần key)
├── marked-terminal.d.ts# khai báo type cho marked-terminal
├── package.json        # có "bin": { "quangiaai": "./cli.mjs" }; tsx ở dependencies
├── tsconfig.json       # jsx: react-jsx, module ESNext, moduleResolution bundler, noEmit
├── .env.example        # mẫu env (OPENAI_API_KEY / OPENAI_BASE_URL / MODEL_ID)
├── .gitignore          # node_modules, .env, config.json
├── CLAUDE.md           # quy tắc làm việc (xem mục 6)
├── README.md           # hướng dẫn người dùng
└── CONTEXT.md          # file này
```

Cấu hình runtime (tạo tự động, NGOÀI repo): `~/.terminalai/config.json` = `{ apiKey, baseURL, model }`.

---

## 5. Kiến trúc & luồng (tóm tắt)

- `handleSubmit` trong `index.tsx`:
  - Lệnh `/...` → xử lý cục bộ (đổi key/model, mở settings/picker), KHÔNG gọi API.
  - Chat thường → `streamText({ model: provider(cfg.model), messages, tools, maxSteps: 6, system })`.
- **Tool calling + approval:** tool `execute` gọi `requestApproval(title, detail)` → trả `Promise<boolean>`; UI set `pendingApproval`, `useInput` bắt phím Y/N rồi `resolve`. `readFile` KHÔNG cần duyệt (chỉ đọc).
- **`maxSteps: 6`** → AI gọi tool xong tự suy luận tiếp tới câu trả lời cuối.
- **State `mode`**: `'chat' | 'settings' | 'editKey' | 'picker'`. Mỗi mode có một `useInput` gắn `isActive` để không tranh chấp phím với `TextInput`.
- **Lịch sử** dùng kiểu `Item { id, role: user|assistant|system, content }`. Khi build messages cho API chỉ lấy `role === user|assistant` (loại bỏ tin `system`/notice để không bẩn ngữ cảnh).
- **`<Static items={items}>`** in lịch sử một lần; streaming và input nằm ngoài Static.

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

- ⚠️ **Model `:free` hay trả HTTP 429** ("rate-limited upstream") — đây là giới hạn tier free của OpenRouter, **KHÔNG phải lỗi code**. Đã xác nhận từng gọi thành công (HTTP 200). Khắc phục: thử lại, đổi model, hoặc thêm key BYOK.
- ⚠️ **Ink cần TTY thật.** Chạy qua pipe / `< /dev/null` thì Ink render một lần rồi thoát (EXIT 1) — bình thường, không phải bug. Không test được chat tương tác trong môi trường không-TTY.
- ⚠️ **`streamText` nuốt lỗi** (textStream trả rỗng khi provider lỗi); muốn debug lỗi thật thì dùng `generateText` hoặc gọi raw `fetch` tới `/chat/completions` để xem body.
- ⚠️ **Ctrl+S** có thể là XOFF (flow control) ở một số terminal, nhưng Ink bật raw mode nên thường nhận được như phím thường.
- ⚠️ Sau khi **di chuyển/xoá thư mục dự án**, lệnh `quangiaai` (npm link) sẽ hỏng → chạy lại `npm link`.

---

## 8. Lệnh kiểm chứng nhanh

```bash
npm run typecheck                  # tsc --noEmit  → phải EXIT 0
npm start                          # chạy app (cần terminal thật)
node cli.mjs < /dev/null | head    # smoke: thấy banner + welcome + input = OK
which quangiaai                    # kiểm tra lệnh toàn cục đã link
```

> Khi gọi live model để test, nhớ có thể dính 429 (xem mục 7). Endpoint `/models` thì public, không dính 429.

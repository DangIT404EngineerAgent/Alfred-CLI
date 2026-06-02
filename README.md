# 🤖 Agentic Terminal AI (Quản gia AI)

Trợ lý AI chạy ngay trên **Terminal**, giao diện viết bằng **React (Ink)**, có khả năng **tự chạy lệnh shell, đọc & ghi file** (agentic) thông qua **OpenRouter**. Cài đặt một lần là gõ lệnh `quangiaai` ở bất kỳ thư mục nào để dùng — giống như `claude` CLI.

> Đồ án tốt nghiệp · Mặc định dùng model miễn phí `moonshotai/kimi-k2.6:free` trên OpenRouter.

---

## ✨ Tính năng

- 💬 **Chat streaming** — chữ chạy realtime từng từ.
- 🎨 **Markdown + tô màu code** ngay trên terminal (`marked-terminal`).
- 🛠️ **Agentic Tool Calling** — AI tự dùng công cụ để làm việc:
  - `runShell` — chạy lệnh terminal
  - `readFile` — đọc file
  - `writeFile` — ghi/đè file
- 🔒 **Hỏi Y/N trước khi chạy lệnh / ghi file** — Cậu duyệt từng hành động.
- ⚙️ **Đổi API key & model thoải mái** — qua lệnh gạch chéo hoặc bảng cài đặt (Ctrl+S).
- 🔎 **Chọn model live từ OpenRouter** — tải danh sách thật, gõ để lọc, ↑↓ chọn.
- 🌍 **Lệnh toàn cục `quangiaai`** — chạy ở mọi thư mục; cấu hình nhớ chung tại `~/.terminalai`.

---

## 🧱 Công nghệ

| Thành phần | Vai trò |
|---|---|
| [Ink](https://github.com/vadimdemedes/ink) | Render React xuống terminal |
| [ink-text-input](https://github.com/vadimdemedes/ink-text-input) | Ô nhập liệu |
| [Vercel AI SDK (`ai`)](https://sdk.vercel.ai) | Streaming + Tool Calling |
| [`@ai-sdk/openai`](https://sdk.vercel.ai/providers/ai-sdk-providers/openai) | Provider tương thích OpenAI (trỏ về OpenRouter) |
| [tsx](https://github.com/privatenumber/tsx) | Chạy TypeScript/TSX trực tiếp, không cần build |
| [zod](https://zod.dev) | Định nghĩa schema tham số cho tool |
| [marked](https://marked.js.org) + [marked-terminal](https://github.com/mikaelbr/marked-terminal) | Render Markdown ra ANSI |

---

## 📋 Yêu cầu

- **Node.js ≥ 18** (khuyến nghị 20+). Kiểm tra: `node -v`
- Một **API key của [OpenRouter](https://openrouter.ai/keys)** (dạng `sk-or-v1-...`).
- Terminal thật (cmd / PowerShell / Git Bash / Windows Terminal). *Không chạy được khi pipe vào nơi không phải terminal.*

---

## 🚀 Cài đặt

### 1. Tải mã & cài thư viện
```bash
cd D:\TerminalAI
npm install
```

### 2. Cài lệnh toàn cục `quangiaai`
```bash
npm link
```
Sau bước này, mở **terminal mới** ở bất kỳ đâu và gõ:
```bash
quangiaai
```

> 💡 Không muốn cài toàn cục? Chạy trực tiếp trong thư mục dự án bằng:
> ```bash
> npm start        # tương đương: npx tsx index.tsx
> ```

---

## 🔑 Cấu hình API Key

Có **3 cách** đặt key (ưu tiên từ trên xuống):

1. **Trong app (khuyến nghị)** — chạy `quangiaai` rồi:
   - Nhấn **Ctrl+S** → `[K]` → dán key → Enter, hoặc
   - Gõ lệnh: `/key sk-or-v1-xxxxx`
   - → Lưu vào `~/.terminalai/config.json`, nhớ vĩnh viễn cho mọi thư mục.

2. **File `.env`** (chỉ áp dụng khi chạy trong thư mục dự án): copy `.env.example` → `.env` rồi điền:
   ```env
   OPENAI_API_KEY=sk-or-v1-xxxxx
   OPENAI_BASE_URL=https://openrouter.ai/api/v1
   MODEL_ID=moonshotai/kimi-k2.6:free
   ```

3. **Biến môi trường hệ thống** cùng tên như trên.

---

## ⌨️ Cách sử dụng

Gõ câu hỏi bình thường để chat. Ngoài ra có các **lệnh gạch chéo**:

| Lệnh | Tác dụng |
|---|---|
| `/help` | Xem danh sách lệnh |
| `/models` | Mở bảng chọn model (tải live từ OpenRouter) |
| `/model <id>` | Đổi nhanh model theo id |
| `/key <api-key>` | Đặt API key |
| `/settings` | Mở bảng cài đặt |
| `exit` | Thoát |

**Phím tắt:**
- `Ctrl+S` — mở/đóng bảng cài đặt. Trong đó: `[M]` đổi model · `[K]` nhập key · `[Esc]` đóng.
- `Ctrl+C` — thoát ngay.

**Bảng chọn model** (`/models` hoặc Ctrl+S → M): gõ chữ để **lọc**, `↑`/`↓` để di chuyển, `Enter` để chọn, `Esc` để huỷ. 🆓 = model miễn phí.

**Khi AI muốn chạy lệnh / ghi file:** sẽ hiện hộp ⚠️ vàng kèm nội dung. Nhấn:
- `Y` → cho phép
- `N` hoặc `Esc` → từ chối

> Ví dụ thử: *"Đọc file package.json rồi liệt kê các script"* hoặc *"Chạy git status giúp tôi"*.

---

## 🗂️ Cấu trúc thư mục

```
TerminalAI/
├── cli.mjs              # Điểm vào của lệnh toàn cục `quangiaai` (shebang + tsImport)
├── index.tsx           # Toàn bộ app Ink: UI, chat, tool calling, cài đặt, picker
├── config.ts           # Đọc/ghi cấu hình tại ~/.terminalai/config.json
├── openrouter.ts       # Tải danh sách model live từ OpenRouter
├── marked-terminal.d.ts# Khai báo kiểu cho thư viện marked-terminal
├── package.json        # Thông tin gói, dependencies, trường "bin"
├── tsconfig.json       # Cấu hình TypeScript (JSX + ESM)
├── .env.example        # Mẫu biến môi trường (copy thành .env)
├── .gitignore          # Bỏ qua node_modules, .env
├── CLAUDE.md           # Quy tắc làm việc cho AI coding assistant
└── README.md           # File này
```

**Cấu hình người dùng (tạo tự động, ngoài thư mục dự án):**
```
~/.terminalai/config.json   # { apiKey, baseURL, model } — KHÔNG commit, chứa key
```

---

## 🔍 Kiến trúc & luồng hoạt động

```
        ┌─────────────────────────── index.tsx (Ink App) ───────────────────────────┐
Cậu gõ →│  TextInput → handleSubmit                                                  │
        │     │                                                                       │
        │     ├─ lệnh "/..."  → xử lý cục bộ (đổi key/model, mở settings/picker)      │
        │     │                                                                       │
        │     └─ chat thường  → streamText({ model, messages, tools, maxSteps })      │
        │                          │                                                  │
        │                          ├─ textStream → cập nhật UI realtime               │
        │                          │                                                  │
        │                          └─ AI gọi tool ──→ requestApproval() ──→ hộp Y/N   │
        │                                              (runShell/readFile/writeFile)  │
        └────────────────────────────────────────────────────────────────────────────┘
              │ provider = createOpenAI({ apiKey, baseURL })   ← từ config.ts
              ▼
        OpenRouter  (https://openrouter.ai/api/v1)  ← danh sách model: openrouter.ts
```

**Các điểm kỹ thuật đáng chú ý:**
- **`<Static>` của Ink** render lịch sử một lần → cuộn mượt, không nhấp nháy khi chat dài.
- **Cầu nối UI ↔ Tool:** tool gọi `requestApproval()` trả về `Promise`, UI bắt phím Y/N rồi `resolve` → đó là cách hỏi xác nhận an toàn ngay trong Ink.
- **`maxSteps: 6`** cho phép AI gọi tool rồi tiếp tục suy luận tới câu trả lời cuối (vòng lặp agentic).
- **Tin nhắn hệ thống** (help, lỗi, thông báo) được tách khỏi lịch sử gửi cho model → không làm "bẩn" ngữ cảnh.
- **`cli.mjs` dùng `tsImport`** của tsx để chạy thẳng TSX, nên không cần bước build.

---

## 🩺 Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| `⚠️ Lỗi khi gọi API ... (429)` | Model `:free` đang bị giới hạn lượt phía OpenRouter. Thử lại sau ít phút, hoặc đổi sang model khác (`/models`), hoặc thêm key riêng tại [OpenRouter Integrations](https://openrouter.ai/settings/integrations). |
| `Chưa có API key` | Đặt key bằng `/key ...` hoặc Ctrl+S → K. |
| `quangiaai: command not found` | Chạy lại `npm link` trong thư mục dự án; đảm bảo thư mục bin global của npm nằm trên PATH. |
| `Raw mode is not supported` | Đang chạy trong môi trường không phải terminal thật (vd pipe/CI). Hãy mở terminal thường. |
| Đổi key/model không có tác dụng | Cấu hình lưu ở `~/.terminalai/config.json`; kiểm tra/sửa trực tiếp file đó nếu cần. |

---

## 🧹 Gỡ cài đặt

```bash
npm unlink -g terminal-ai
```

> Lệnh `quangiaai` trỏ tới thư mục dự án hiện tại. Nếu **di chuyển/xoá** thư mục, hãy `npm link` lại ở vị trí mới.

---

## 📜 Lệnh hữu ích (dev)

```bash
npm start          # chạy app trong thư mục dự án
npm run typecheck  # kiểm tra kiểu TypeScript (không build)
```

---

## ⚠️ Ghi chú bảo mật

- `~/.terminalai/config.json` lưu API key dạng **văn bản thuần** — không chia sẻ/commit file này.
- File `.env` và `config.json` đã được `.gitignore`.
- AI luôn **hỏi Y/N** trước khi chạy lệnh hoặc ghi file — đọc kỹ nội dung trước khi bấm `Y`.

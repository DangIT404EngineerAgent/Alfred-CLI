# 🤖 Agentic Terminal AI (Quản gia AI)

Một trợ lý AI hiện đại chạy trực tiếp trên **Terminal**, được xây dựng bằng **React (Ink)**. AI đóng vai trò như một tác nhân tự trị (autonomous agent), có khả năng **tự động chạy lệnh shell, đọc, và chỉnh sửa file** ngay trong thư mục dự án thông qua **OpenRouter**. Cài đặt một lần và sử dụng lệnh `quangiaai` ở bất cứ đâu — tương tự như `claude` CLI.

> 🎓 Đồ án tốt nghiệp · Mặc định sử dụng model miễn phí `moonshotai/kimi-k2.6:free` qua OpenRouter.

*[Read the English version here](./README.md)*

---

## ✨ Tính năng nổi bật

- 💬 **Chat Streaming** — Phản hồi hiển thị thời gian thực theo từng từ.
- 🎨 **Giao diện Terminal Phong phú** — Hỗ trợ đầy đủ Markdown và tô màu cú pháp code (`marked-terminal`).
- 🛠️ **Công cụ Agentic Nâng cao** — AI có thể tự chủ sử dụng công cụ để hoàn thành công việc:
  - `runShell` — Thực thi các lệnh bash/powershell.
  - `readFile` — Đọc nội dung file (tự động cắt bớt phần thừa nếu file > 50KB để chống tràn bộ nhớ).
  - `writeFile` — Tạo mới hoặc ghi đè toàn bộ file.
  - `replaceInFile` — Chỉnh sửa thay thế văn bản tinh gọn trong các file lớn mà không cần in lại toàn bộ nội dung.
  - `searchProject` — Dò tìm từ khóa trên toàn bộ dự án (tương tự như `grep`).
- 🛡️ **Duyệt lệnh Tương tác (Y/N)** — AI luôn phải xin phép Cậu chủ trước khi thực thi lệnh shell hay thay đổi file.
- 📎 **Đính kèm File Thông minh (`@`)** — Gõ `@` để mở danh sách chọn file. Hệ thống tự động đọc `.gitignore` và bỏ qua các thư mục ẩn/thư mục build.
- 🧠 **Quản lý Ngữ cảnh (Context Management)** — Sử dụng thuật toán Trượt cửa sổ (Sliding Window) để giữ lại 20 tin nhắn gần nhất, ngăn chặn lỗi vượt quá giới hạn Token.
- 🛑 **Ngắt lệnh An toàn (Graceful Interrupt)** — Nhấn `Ctrl+C` trong lúc AI đang stream text để dừng yêu cầu một cách an toàn mà không làm sập ứng dụng.
- ⚡ **Khởi động Tức thì** — Mã nguồn được đóng gói (bundle) bằng `tsup` thành một file JavaScript gọn nhẹ, cho tốc độ khởi động chớp nhoáng.
- 🌍 **CLI Toàn cục** — Gọi `quangiaai` ở bất kỳ thư mục nào. Cấu hình được lưu chung tại `~/.terminalai`.

---

## 📋 Yêu cầu Hệ thống

- **Node.js ≥ 18** (Khuyến nghị bản 20+). Kiểm tra bằng lệnh: `node -v`
- Một **[OpenRouter API Key](https://openrouter.ai/keys)** (bắt đầu bằng `sk-or-v1-...`).
- Terminal chuẩn (cmd / PowerShell / Git Bash / Windows Terminal).

---

## 🚀 Hướng dẫn Cài đặt

### 1. Tải mã nguồn & Cài đặt thư viện
```bash
cd /path/to/TerminalAI
npm install
```

### 2. Build ứng dụng CLI
```bash
npm run build
```

### 3. Liên kết Toàn cục (Global Link)
```bash
npm link
```
Sau đó, hãy mở một **terminal mới** ở bất kỳ thư mục nào và gõ:
```bash
quangiaai
```

---

## 🔑 Cấu hình API Key

Có **3 cách** để thiết lập API key (ưu tiên từ trên xuống dưới):

1. **Trong ứng dụng (Khuyến nghị):** Chạy lệnh `quangiaai` và:
   - Nhấn **Ctrl+S** → `[K]` → dán key vào → Enter.
   - Hoặc gõ trực tiếp lệnh: `/key sk-or-v1-xxxxx`
   - *(Key sẽ được lưu tại `~/.terminalai/config.json`)*
2. **File `.env`** (Chỉ dùng cho dự án cục bộ): Copy file `.env.example` thành `.env` và điền thông tin.
3. **Biến môi trường hệ thống (Environment Variables).**

---

## ⌨️ Cách Sử Dụng

Bạn chỉ cần gõ câu hỏi hoặc yêu cầu. AI sẽ chủ động sử dụng công cụ nếu cần thiết.

**Các Lệnh Gạch Chéo (Slash Commands):**
| Lệnh | Mô tả |
|---|---|
| `/help` | Hiển thị danh sách trợ giúp |
| `/models` | Mở bảng chọn model trực tiếp từ OpenRouter |
| `/model <id>` | Đổi nhanh sang một model cụ thể |
| `/key <api-key>` | Lưu API key của bạn |
| `/settings` | Mở bảng cài đặt |
| `exit` | Thoát ứng dụng |

**Phím tắt:**
- `Ctrl+S` — Mở/đóng bảng cài đặt. (`[M]` để đổi model · `[K]` nhập key · `[Esc]` đóng).
- `Ctrl+C` — Dừng phản hồi của AI hoặc thoát.
- `@` — Gõ ký tự `@` để tìm kiếm và đính kèm file vào câu hỏi.

> **Dùng thử:** *"Sử dụng searchProject để tìm hàm `handleSubmit`, sau đó dùng replaceInFile thêm một dòng console.log vào đầu hàm đó giúp tôi."*

---

## 🧱 Ngăn xếp Công nghệ (Tech Stack)

- **[Ink](https://github.com/vadimdemedes/ink):** React dành riêng cho việc xây dựng giao diện CLI.
- **[Vercel AI SDK](https://sdk.vercel.ai):** Quản lý quá trình Streaming và gọi Tool (Tool Calling).
- **[tsup](https://tsup.egoist.dev/):** Bộ đóng gói (bundler) TypeScript siêu tốc.
- **[ignore](https://www.npmjs.com/package/ignore):** Trình phân tích `.gitignore` giúp quét file thông minh.
- **[ink-spinner](https://www.npmjs.com/package/ink-spinner):** Tạo hiệu ứng loading sinh động.

---

## 🩺 Xử lý Sự cố

- `⚠️ Error (429)`: Các model miễn phí trên OpenRouter đang bị giới hạn lượt gọi (rate-limited). Hãy chờ vài phút, chuyển sang model khác (`/models`), hoặc nạp thêm credit.
- `quangiaai: command not found`: Chạy lại lệnh `npm link`. Đảm bảo rằng thư mục bin global của npm đã được thêm vào PATH của hệ thống.
- `Raw mode is not supported`: Bạn đang chạy trong môi trường không phải là TTY (ví dụ như CI pipeline). Vui lòng sử dụng terminal tiêu chuẩn.

## 🧹 Gỡ cài đặt

```bash
npm unlink -g terminal-ai
```
*(Nếu bạn di chuyển hoặc xoá thư mục dự án, lệnh quangiaai sẽ bị lỗi cho tới khi bạn chạy `npm link` lại)*

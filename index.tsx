import React, { useMemo, useRef, useState } from 'react';
import { render, Text, Box, useApp, useInput, Static } from 'ink';
import TextInput from 'ink-text-input';
import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, readdirSync, type Dirent } from 'fs';
import { relative, join, sep } from 'path';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { loadConfig, saveConfig, type AppConfig } from './config';
import { fetchModels, type ModelInfo } from './openrouter';

loadEnv(); // nạp .env (làm giá trị mặc định cho config)
const execAsync = promisify(exec);

// ---- Markdown -> ANSI cho terminal ----
const TERM_WIDTH = Math.min(100, (process.stdout.columns || 80) - 2);
marked.use(markedTerminal({ width: TERM_WIDTH, reflowText: true }) as any);
function renderMarkdown(text: string): string {
  try {
    return (marked.parse(text) as string).replace(/\n+$/, '');
  } catch {
    return text;
  }
}

function maskKey(k: string): string {
  if (k.length <= 12) return k ? '••••' : '(chưa có)';
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

// ---- Quét file cho tính năng @ (đệ quy, bỏ node_modules/.git/thư mục ẩn) ----
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);
function scanFiles(root: string, max = 2000): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (out.length >= max) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= max) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        walk(full);
      } else if (e.isFile()) {
        out.push(relative(root, full).split(sep).join('/'));
      }
    }
  };
  walk(root);
  return out;
}

// Token @ đang gõ ở cuối input (đứng đầu dòng hoặc sau khoảng trắng).
const AT_RE = /(^|\s)@([^@\s]*)$/;

const HELP_TEXT =
  'Các lệnh:\n' +
  '  /help            – xem trợ giúp này\n' +
  '  /models          – chọn model từ danh sách OpenRouter (live)\n' +
  '  /model <id>      – đổi nhanh sang model theo id\n' +
  '  /key <api-key>   – đặt API key OpenRouter\n' +
  '  /settings        – mở bảng cài đặt (hoặc nhấn Ctrl+S)\n' +
  '  exit             – thoát';

type Mode = 'chat' | 'settings' | 'editKey' | 'picker';
type Item = { id: number; role: 'user' | 'assistant' | 'system'; content: string };
type PendingApproval = { title: string; detail: string; resolve: (ok: boolean) => void };

function MessageView({ item }: { item: Item }) {
  const { role } = item;
  const label = role === 'user' ? '👨‍💻 Cậu chủ' : role === 'system' ? 'ℹ️  Hệ thống' : '🎩 Quản gia AI';
  const color = role === 'user' ? 'blue' : role === 'system' ? 'yellow' : 'green';
  const content = role === 'assistant' ? renderMarkdown(item.content) : item.content;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>{label}</Text>
      <Text>{content}</Text>
    </Box>
  );
}

const App = () => {
  const { exit } = useApp();
  const [cfg, setCfg] = useState<AppConfig>(() => loadConfig());
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;
  const [items, setItems] = useState<Item[]>(() => [
    { id: 0, role: 'system', content: 'Chào Cậu chủ! Gõ /help để xem lệnh, Ctrl+S để mở cài đặt.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamTextState, setStreamTextState] = useState('');
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [mode, setMode] = useState<Mode>('chat');
  const [keyDraft, setKeyDraft] = useState('');

  // @ gắn file
  const [attachments, setAttachments] = useState<{ path: string; inline: boolean }[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [atCursor, setAtCursor] = useState(0);

  // picker state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState(0);

  const addItem = (role: Item['role'], content: string) =>
    setItems((xs) => [...xs, { id: nextId(), role, content }]);

  const applyCfg = (next: AppConfig) => {
    setCfg(next);
    saveConfig(next);
  };

  const provider = useMemo(
    () => createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, compatibility: 'compatible' }),
    [cfg.apiKey, cfg.baseURL]
  );

  // Cầu nối UI <-> tool: tool xin phép, UI bắt Y/N rồi resolve.
  const requestApproval = (title: string, detail: string) =>
    new Promise<boolean>((resolve) => setPendingApproval({ title, detail, resolve }));

  const openPicker = async () => {
    setMode('picker');
    setPickerLoading(true);
    setPickerError('');
    setFilter('');
    setCursor(0);
    try {
      setModels(await fetchModels(cfg.baseURL));
    } catch (e: any) {
      setPickerError('Không tải được danh sách model: ' + e.message);
    } finally {
      setPickerLoading(false);
    }
  };

  const filtered = useMemo(
    () => models.filter((m) => m.id.toLowerCase().includes(filter.toLowerCase())),
    [models, filter]
  );

  // ---- @ gắn file: phát hiện token @ đang gõ ----
  const atMatch = mode === 'chat' ? input.match(AT_RE) : null;
  const atQuery = atMatch ? atMatch[2] : '';
  const atActive = !!atMatch && !isLoading && !pendingApproval;
  const atFiltered = useMemo(
    () =>
      atActive
        ? allFiles.filter((f) => f.toLowerCase().includes(atQuery.toLowerCase())).slice(0, 200)
        : [],
    [allFiles, atQuery, atActive]
  );

  const handleInputChange = (val: string) => {
    setInput(val);
    setAtCursor(0);
    if (AT_RE.test(val) && allFiles.length === 0) setAllFiles(scanFiles(process.cwd()));
  };

  // Chèn file đã chọn vào ô nhập; inline=true → nhúng nội dung, false → chỉ gắn thẻ @path.
  const selectFile = (file: string, inline: boolean) => {
    setInput((prev) => prev.replace(AT_RE, (_m, pre) => `${pre}@${file} `));
    setAttachments((xs) => [...xs.filter((x) => x.path !== file), { path: file, inline }]);
    setAtCursor(0);
  };

  // ---- input handlers theo từng mode ----
  useInput(
    (char, key) => {
      if (key.ctrl && char === 's') setMode('settings');
    },
    { isActive: mode === 'chat' && !pendingApproval && !isLoading }
  );

  useInput(
    (char, key) => {
      const c = char.toLowerCase();
      if (c === 'y') {
        pendingApproval?.resolve(true);
        setPendingApproval(null);
      } else if (c === 'n' || key.escape) {
        pendingApproval?.resolve(false);
        setPendingApproval(null);
      }
    },
    { isActive: !!pendingApproval }
  );

  useInput(
    (char, key) => {
      const c = char.toLowerCase();
      if (key.escape) setMode('chat');
      else if (c === 'm') openPicker();
      else if (c === 'k') {
        setKeyDraft('');
        setMode('editKey');
      }
    },
    { isActive: mode === 'settings' }
  );

  useInput(
    (char, key) => {
      if (key.escape) setMode('chat');
    },
    { isActive: mode === 'editKey' }
  );

  useInput(
    (char, key) => {
      if (key.escape) {
        setMode('chat');
        return;
      }
      if (pickerLoading) return;
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(Math.max(0, filtered.length - 1), c + 1));
        return;
      }
      if (key.return) {
        const sel = filtered[cursor];
        if (sel) {
          applyCfg({ ...cfg, model: sel.id });
          addItem('system', `✅ Đã đổi model: ${sel.id}`);
          setMode('chat');
        }
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((f) => f.slice(0, -1));
        setCursor(0);
        return;
      }
      if (char && !key.ctrl && !key.meta) {
        setFilter((f) => f + char);
        setCursor(0);
      }
    },
    { isActive: mode === 'picker' }
  );

  // điều hướng danh sách @ (↑↓ chọn, Tab = chỉ gắn thẻ). Enter xử lý trong handleSubmit.
  useInput(
    (_char, key) => {
      if (key.upArrow) return setAtCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) return setAtCursor((c) => Math.min(Math.max(0, atFiltered.length - 1), c + 1));
      if (key.tab) {
        const f = atFiltered[atCursor];
        if (f) selectFile(f, false);
      }
    },
    { isActive: mode === 'chat' && atActive && !isLoading && !pendingApproval }
  );

  const handleSubmit = async () => {
    if (isLoading || pendingApproval) return;
    // Đang chọn file qua @: Enter = chèn kèm nội dung file.
    if (atActive) {
      const f = atFiltered[atCursor];
      if (f) selectFile(f, true);
      return;
    }
    const text = input.trim();
    setInput('');
    if (!text) return;

    // ---- lệnh gạch chéo ----
    if (text === 'exit' || text === '/exit' || text === '/quit') return exit();
    if (text === '/help') return addItem('system', HELP_TEXT);
    if (text === '/settings') return setMode('settings');
    if (text === '/models') return void openPicker();
    if (text.startsWith('/key ')) {
      applyCfg({ ...cfg, apiKey: text.slice(5).trim() });
      return addItem('system', '✅ Đã lưu API key mới.');
    }
    if (text.startsWith('/model ')) {
      const m = text.slice(7).trim();
      applyCfg({ ...cfg, model: m });
      return addItem('system', `✅ Đã đổi model: ${m}`);
    }
    if (text.startsWith('/')) return addItem('system', 'Lệnh không hợp lệ. Gõ /help để xem danh sách.');

    // ---- chat thường ----
    if (!cfg.apiKey) {
      return addItem('system', 'Chưa có API key. Dùng /key <api-key> hoặc nhấn Ctrl+S để nhập.');
    }

    // ---- gắn file @: nhúng nội dung cho mục inline, mục còn lại để AI tự readFile ----
    const used = attachments.filter((a) => text.includes('@' + a.path));
    let inlineCtx = '';
    for (const a of used) {
      if (!a.inline) continue;
      try {
        inlineCtx += `\n\n[Nội dung file ${a.path}]\n\`\`\`\n${readFileSync(a.path, 'utf8')}\n\`\`\``;
      } catch (e: any) {
        inlineCtx += `\n\n[Không đọc được ${a.path}: ${e.message}]`;
      }
    }
    const aiText = text + inlineCtx;

    const apiMessages: CoreMessage[] = [
      ...items
        .filter((i) => i.role === 'user' || i.role === 'assistant')
        .map((i) => ({ role: i.role, content: i.content }) as CoreMessage),
      { role: 'user', content: aiText },
    ];
    addItem('user', text);
    setAttachments([]);
    setIsLoading(true);
    setStreamTextState('');

    const tools = {
      runShell: tool({
        description: 'Chạy một câu lệnh terminal (bash/zsh) để kiểm tra log, test code, xem git status, v.v.',
        parameters: z.object({ command: z.string().describe('Câu lệnh cần chạy') }),
        execute: async ({ command }) => {
          if (!(await requestApproval('Chạy lệnh shell', command))) return 'Người dùng đã TỪ CHỐI chạy lệnh này.';
          try {
            const { stdout, stderr } = await execAsync(command, { timeout: 60000, maxBuffer: 1024 * 1024 });
            return (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '') || '(không có output)';
          } catch (e: any) {
            return `Lỗi: ${e.message}\n${e.stdout || ''}${e.stderr || ''}`;
          }
        },
      }),
      readFile: tool({
        description: 'Đọc nội dung một file để xem code hoặc dữ liệu.',
        parameters: z.object({ path: z.string().describe('Đường dẫn file cần đọc') }),
        execute: async ({ path }) => {
          try {
            return readFileSync(path, 'utf8');
          } catch (e: any) {
            return `Lỗi: ${e.message}`;
          }
        },
      }),
      writeFile: tool({
        description: 'Ghi/đè nội dung vào một file (tạo mới hoặc thay thế toàn bộ).',
        parameters: z.object({
          path: z.string().describe('Đường dẫn file cần ghi'),
          content: z.string().describe('Nội dung đầy đủ sẽ ghi vào file'),
        }),
        execute: async ({ path, content }) => {
          const preview = content.length > 500 ? content.slice(0, 500) + '\n... (đã rút gọn)' : content;
          if (!(await requestApproval(`Ghi file: ${path}`, preview))) return 'Người dùng đã TỪ CHỐI ghi file này.';
          try {
            writeFileSync(path, content, 'utf8');
            return `Đã ghi xong file: ${path}`;
          } catch (e: any) {
            return `Lỗi: ${e.message}`;
          }
        },
      }),
    };

    const system =
      'Bạn là Quản gia AI, trợ lý đắc lực cho Cậu chủ Đăng - sinh viên IT năm cuối. ' +
      'Bạn có các công cụ: runShell (chạy lệnh terminal), readFile (đọc file), writeFile (ghi file). ' +
      'Hãy chủ động dùng công cụ để hoàn thành việc Cậu chủ giao thay vì chỉ hướng dẫn suông. ' +
      'Kiên trì làm tới khi xong trọn vẹn yêu cầu, không bỏ dở giữa chừng; nếu còn bước thì làm tiếp. ' +
      'Trả lời ngắn gọn, súc tích, dùng markdown cho code.';

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const MAX_RETRIES = 4; // tự kết nối lại khi lỗi mạng/429/AI im lặng
    const MAX_CONTINUE = 3; // tự nhắc "tiếp tục" khi AI dừng giữa chừng

    // Gọi model 1 lượt, trả về { text, finishReason }; ném lỗi nếu provider lỗi.
    const callOnce = async (msgs: CoreMessage[], prefix: string) => {
      const result = streamText({ model: provider(cfg.model), messages: msgs, maxSteps: 25, tools, system });
      let full = '';
      for await (const chunk of result.textStream) {
        full += chunk;
        setStreamTextState(prefix + full);
      }
      const finishReason = await result.finishReason;
      if (finishReason === 'error') throw new Error('Provider trả về lỗi');
      return { text: full, finishReason };
    };

    // Bọc retry: lỗi kết nối/429 hoặc AI im lặng đều thử lại với backoff.
    const callWithRetry = async (msgs: CoreMessage[], prefix: string) => {
      let lastErr: any;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const r = await callOnce(msgs, prefix);
          const silent = !r.text.trim() && ['stop', 'other', 'unknown'].includes(r.finishReason as string);
          if (silent && attempt < MAX_RETRIES) throw new Error('AI không phản hồi (rỗng)');
          return r;
        } catch (e: any) {
          lastErr = e;
          if (attempt >= MAX_RETRIES) break;
          const wait = 1500 * Math.pow(2, attempt);
          setStreamTextState(
            prefix +
              `\n⏳ ${e?.message || 'Lỗi kết nối'} — tự kết nối lại (lần ${attempt + 1}/${MAX_RETRIES}), chờ ${Math.round(
                wait / 1000
              )}s…`
          );
          await sleep(wait);
        }
      }
      throw lastErr;
    };

    try {
      let msgs = apiMessages;
      let combined = '';
      for (let cont = 0; cont <= MAX_CONTINUE; cont++) {
        const prefix = combined ? combined + '\n' : '';
        const { text: turnText, finishReason } = await callWithRetry(msgs, prefix);
        combined = prefix + turnText;
        // AI bị cắt vì hết độ dài → tự nhắc tiếp tục để làm cho xong.
        if (finishReason === 'length' && cont < MAX_CONTINUE) {
          msgs = [
            ...msgs,
            { role: 'assistant', content: turnText || '(tiếp tục)' },
            { role: 'user', content: 'Hãy tiếp tục hoàn thành nốt phần còn dang dở, đừng dừng giữa chừng.' },
          ];
          continue;
        }
        break;
      }
      addItem('assistant', combined || '(đã thực hiện xong tác vụ)');
      setStreamTextState('');
    } catch (e: any) {
      addItem(
        'system',
        `⚠️ Đã thử kết nối lại nhiều lần nhưng vẫn lỗi: ${e?.message || ''}. Kiểm tra API key/mạng, hoặc model free đang bị giới hạn (429).`
      );
      setStreamTextState('');
    } finally {
      setIsLoading(false);
    }
  };

  // ---- windowing cho picker ----
  const WINDOW = 10;
  const start = Math.max(0, Math.min(cursor - Math.floor(WINDOW / 2), Math.max(0, filtered.length - WINDOW)));
  const windowed = filtered.slice(start, start + WINDOW);

  // ---- windowing cho danh sách @ ----
  const AT_WINDOW = 8;
  const atStart = Math.max(0, Math.min(atCursor - Math.floor(AT_WINDOW / 2), Math.max(0, atFiltered.length - AT_WINDOW)));
  const atWindowed = atFiltered.slice(atStart, atStart + AT_WINDOW);

  return (
    <Box flexDirection="column">
      {/* Lịch sử in một lần, cuộn tự nhiên, không nhấp nháy */}
      <Static items={items}>{(item) => <MessageView key={item.id} item={item} />}</Static>

      {/* Streaming text đang chạy */}
      {streamTextState && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">🎩 Quản gia AI</Text>
          <Text>{streamTextState}</Text>
        </Box>
      )}

      {isLoading && !streamTextState && !pendingApproval && (
        <Text color="yellow" italic>… Quản gia đang suy nghĩ …</Text>
      )}

      {/* Hộp xin phép */}
      {pendingApproval && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginBottom={1}>
          <Text bold color="yellow">⚠️ AI muốn: {pendingApproval.title}</Text>
          <Text>{pendingApproval.detail}</Text>
          <Text bold color="cyan">→ [Y] CHO PHÉP · [N] TỪ CHỐI</Text>
        </Box>
      )}

      {/* Bảng cài đặt */}
      {mode === 'settings' && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">⚙️  Cài đặt (OpenRouter)</Text>
          <Text>API key : {maskKey(cfg.apiKey)}</Text>
          <Text>Base URL: {cfg.baseURL}</Text>
          <Text>Model   : {cfg.model}</Text>
          <Text dimColor>[M] đổi model · [K] nhập API key · [Esc] đóng</Text>
        </Box>
      )}

      {/* Nhập API key */}
      {mode === 'editKey' && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">Nhập OpenRouter API key (Enter để lưu · Esc để huỷ):</Text>
          <TextInput
            value={keyDraft}
            onChange={setKeyDraft}
            mask="*"
            onSubmit={() => {
              applyCfg({ ...cfg, apiKey: keyDraft.trim() });
              addItem('system', '✅ Đã lưu API key mới.');
              setMode('settings');
            }}
          />
        </Box>
      )}

      {/* Chọn model */}
      {mode === 'picker' && (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
          <Text bold color="magenta">🔎 Chọn model — gõ để lọc · ↑↓ chọn · Enter xác nhận · Esc huỷ</Text>
          <Text>Lọc: {filter || '(tất cả)'}</Text>
          {pickerLoading && <Text color="yellow">Đang tải danh sách từ OpenRouter…</Text>}
          {pickerError && <Text color="red">{pickerError}</Text>}
          {!pickerLoading &&
            windowed.map((m, i) => {
              const selected = start + i === cursor;
              return (
                <Text key={m.id} color={selected ? 'cyan' : undefined} inverse={selected}>
                  {selected ? '› ' : '  '}
                  {m.free ? '🆓 ' : '   '}
                  {m.id}
                </Text>
              );
            })}
          {!pickerLoading && !pickerError && <Text dimColor>{filtered.length} model</Text>}
        </Box>
      )}

      {/* Khung nhập chat */}
      {mode === 'chat' && !pendingApproval && !isLoading && (
        <Box flexDirection="column">
          <Text color="blue" bold>👨‍💻 Cậu chủ</Text>
          <Box>
            <Text color="blue">❯ </Text>
            <TextInput
              value={input}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder="Nhập câu hỏi, gõ @ để gắn file, /help, hoặc 'exit'…"
            />
          </Box>

          {/* Danh sách file khi gõ @ */}
          {atActive && (
            <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
              <Text bold color="magenta">📎 Gắn file — gõ để lọc · ↑↓ chọn · Enter kèm nội dung · Tab chỉ gắn thẻ</Text>
              {atFiltered.length === 0 && <Text dimColor>Không có file khớp “{atQuery || '(tất cả)'}”.</Text>}
              {atWindowed.map((f, i) => {
                const selected = atStart + i === atCursor;
                return (
                  <Text key={f} color={selected ? 'cyan' : undefined} inverse={selected}>
                    {selected ? '› ' : '  '}
                    {f}
                  </Text>
                );
              })}
              {atFiltered.length > 0 && <Text dimColor>{atFiltered.length} file</Text>}
            </Box>
          )}

          {/* File đã đính kèm trong tin sắp gửi */}
          {attachments.length > 0 && (
            <Text dimColor>
              📎 {attachments.map((a) => `@${a.path}${a.inline ? ' (nội dung)' : ' (thẻ)'}`).join('  ·  ')}
            </Text>
          )}

          <Text dimColor>Model: {cfg.model}  ·  @ gắn file · /help · /models · Ctrl+S cài đặt</Text>
        </Box>
      )}
    </Box>
  );
};

console.log('🤖 Agentic Terminal — Dành riêng cho Cậu chủ Đăng\n');
render(<App />);

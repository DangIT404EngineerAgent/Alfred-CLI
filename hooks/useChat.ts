import { useState, useRef, useMemo, useCallback } from 'react';
import { streamText, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { readFileSync } from 'fs';
import { getEncoding } from 'js-tiktoken';
import { type Item } from '../components/MessageView';
import { createTools, type ApprovalRequest } from '../tools';
import { type AppConfig } from '../config';
import { logError } from '../utils/logger';

export type PendingApprovalItem = { title: string; detail: string; data?: any; resolve: (ok: boolean) => void };
export type PendingApprovalBatch = { items: PendingApprovalItem[]; resolveAll: (ok: boolean) => void };

export type ToolCallState = {
  id: string;
  name: string;
  args: any;
  status: 'running' | 'done' | 'error';
  result?: any;
};

export function useChat(cfg: AppConfig) {
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;
  const abortControllerRef = useRef<AbortController | null>(null);

  const [items, setItems] = useState<Item[]>([
    { id: 0, role: 'system', content: 'Chào Cậu chủ! Gõ /help để xem lệnh, Ctrl+S để mở cài đặt.' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamTextState, setStreamTextState] = useState('');
  const [toolStatus, setToolStatus] = useState('');
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalBatch | null>(null);
  const [activeTools, setActiveTools] = useState<ToolCallState[]>([]);

  const approvalQueueRef = useRef<PendingApprovalItem[]>([]);
  const batchTimeoutRef = useRef<any>(null);

  const addItem = (role: Item['role'], content: string, attachments?: string[]) =>
    setItems((xs) => [...xs, { id: nextId(), role, content, attachments }]);

  const provider = useMemo(
    () => createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, compatibility: 'compatible' }),
    [cfg.apiKey, cfg.baseURL]
  );

  const requestApproval: ApprovalRequest = useCallback((title, detail, data) => {
    return new Promise((resolve) => {
      approvalQueueRef.current.push({ title, detail, data, resolve });
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = setTimeout(() => {
        const items = [...approvalQueueRef.current];
        approvalQueueRef.current = [];
        setPendingApproval((prev) => {
          if (prev) {
             return {
                items: [...prev.items, ...items],
                resolveAll: (ok: boolean) => {
                   prev.items.forEach(i => i.resolve(ok));
                   items.forEach(i => i.resolve(ok));
                   setPendingApproval(null);
                }
             };
          }
          return {
            items,
            resolveAll: (ok: boolean) => {
              items.forEach(i => i.resolve(ok));
              setPendingApproval(null);
            }
          };
        });
      }, 50);
    });
  }, []);

  const tools = useMemo(() => createTools(requestApproval, setToolStatus), [requestApproval, setToolStatus]);

  const abort = () => {
     abortControllerRef.current?.abort();
  };

  const submitChat = async (
    text: string,
    attachments: { path: string; inline: boolean }[],
    clearAttachments: () => void
  ) => {
    if (isLoading || pendingApproval) return;
    if (!text) return;

    if (!cfg.apiKey) {
      addItem('system', 'Chưa có API key. Dùng /key <api-key> hoặc nhấn Ctrl+S để nhập.');
      return;
    }

    const used = attachments.filter((a) => text.includes('@' + a.path));
    let inlineCtx = '';
    const MAX_FILE_SIZE = 50 * 1024;
    for (const a of used) {
      if (!a.inline) continue;
      try {
        let content = readFileSync(a.path, 'utf8');
        let warning = '';
        if (content.length > MAX_FILE_SIZE) {
          content = content.slice(0, MAX_FILE_SIZE);
          warning = `\n[CẢNH BÁO: File quá lớn. Đã cắt gọn còn 50KB để tránh tràn bộ nhớ.]`;
        }
        inlineCtx += `\n\n[Nội dung file ${a.path}]${warning}\n\`\`\`\n${content}\n\`\`\``;
      } catch (e: any) {
        inlineCtx += `\n\n[Không đọc được ${a.path}: ${e.message}]`;
        logError(e);
      }
    }
    const aiText = text + inlineCtx;

    const MAX_TOKENS = 120_000;
    const historyMessages = items.filter((i) => i.role === 'user' || i.role === 'assistant');
      
    let contextMessages: CoreMessage[] = [];
    let currentTokens = 0;
    
    // Tích hợp Tokenizer thực tế
    let getTokens: (text: string) => number;
    try {
      const enc = getEncoding('cl100k_base');
      getTokens = (text: string) => enc.encode(text).length;
    } catch(e) {
      // Fallback an toàn nếu lỗi thư viện
      getTokens = (text: string) => Math.ceil(text.length / 4);
    }

    for (let i = historyMessages.length - 1; i >= 0; i--) {
      const msg = historyMessages[i];
      const tokens = getTokens(msg.content);
      if (currentTokens + tokens > MAX_TOKENS && contextMessages.length > 0) {
        contextMessages.unshift({
          role: 'user',
          content: '[HỆ THỐNG: Lịch sử hội thoại cũ đã bị cắt bớt để tiết kiệm bộ nhớ.]'
        });
        break;
      }
      contextMessages.unshift({ role: msg.role, content: msg.content } as CoreMessage);
      currentTokens += tokens;
    }

    let projectContext = '';
    const ctxFiles = ['.quangiaairc', '.cursorrules', '.ai-instructions.md', 'CLAUDE.md'];
    for (const file of ctxFiles) {
       try {
          const content = readFileSync(file, 'utf8');
          projectContext += `\n\n[Context từ ${file}]\n${content}`;
       } catch(e) {}
    }

    // System prompt được giữ nguyên cấu trúc đầu tiên trong danh sách 
    // và thiết lập 'ephemeral' để tối ưu hóa Prompt Caching của Anthropic/OpenRouter
    const system =
      'Bạn là Quản gia AI, trợ lý đắc lực cho Cậu chủ Đăng - sinh viên IT năm cuối. ' +
      'Bạn có các công cụ: runShell, readFile, writeFile, replaceInFile, searchProject, listDirectory, createDirectory, deleteFile, getFileMetadata. ' +
      'Hãy chủ động dùng công cụ để hoàn thành việc Cậu chủ giao thay vì chỉ hướng dẫn suông. ' +
      'Kiên trì làm tới khi xong trọn vẹn yêu cầu, không bỏ dở giữa chừng; nếu còn bước thì làm tiếp. ' +
      'Trả lời ngắn gọn, súc tích, dùng markdown cho code.' + projectContext;

    const apiMessages: CoreMessage[] = [
      {
        role: 'system',
        content: system,
        experimental_providerMetadata: { anthropic: { cacheControl: { type: 'ephemeral' } } }
      },
      ...contextMessages,
      { 
        role: 'user', 
        content: aiText,
        experimental_providerMetadata: { anthropic: { cacheControl: { type: 'ephemeral' } } }
      },
    ];
    
    addItem('user', text, used.map((a) => a.path));
    clearAttachments();
    setIsLoading(true);
    setStreamTextState('');

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const MAX_RETRIES = 4;
    const MAX_CONTINUE = 3;

    const callOnce = async (msgs: CoreMessage[], prefix: string, modelId: string) => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      const result = streamText({ 
        model: provider(modelId), 
        messages: msgs, 
        maxSteps: 25, 
        tools, 
        abortSignal: abortController.signal
      });
      
      let full = '';
      try {
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta') {
            full += chunk.textDelta;
            setStreamTextState(prefix + full);
          } else if (chunk.type === 'tool-call') {
            setActiveTools((prev) => [...prev, {
              id: chunk.toolCallId,
              name: chunk.toolName,
              args: chunk.args,
              status: 'running'
            }]);
          } else if (chunk.type === 'tool-result') {
            setActiveTools((prev) => prev.map(t => 
              t.id === chunk.toolCallId 
                ? { ...t, status: 'done', result: chunk.result }
                : t
            ));
          }
        }
        const finishReason = await result.finishReason;
        if (finishReason === 'error') throw new Error('Provider trả về lỗi');
        return { text: full, finishReason };
      } catch (e: any) {
        logError(e);
        if (e.name === 'AbortError') return { text: full, finishReason: 'abort' };
        throw e;
      } finally {
        abortControllerRef.current = null;
      }
    };

    const callWithRetry = async (msgs: CoreMessage[], prefix: string) => {
      let lastErr: any;
      let currentModel = cfg.model;
      const fallbacks = [
        'google/gemini-2.5-flash:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'mistralai/mistral-7b-instruct:free'
      ];
      let limitHits = 0;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const r = await callOnce(msgs, prefix, currentModel);
          const silent = !r.text.trim() && ['stop', 'other', 'unknown'].includes(r.finishReason as string);
          if (silent && attempt < MAX_RETRIES) throw new Error('AI không phản hồi (rỗng)');
          return r;
        } catch (e: any) {
          lastErr = e;
          if (attempt >= MAX_RETRIES) break;
          
          const errStr = e?.message || e?.toString() || '';
          if (errStr.includes('429') || e?.statusCode === 429 || e?.status === 429) {
             limitHits++;
             if (limitHits >= 2 && fallbacks.length > 0) {
                currentModel = fallbacks.shift() as string;
                limitHits = 0;
                setStreamTextState(prefix + `\n🔄 [Dự phòng] Model nghẽn mạng (429). Đang chuyển sang: ${currentModel}…`);
                await sleep(1000);
                continue;
             }
          }
          
          const wait = 1500 * Math.pow(2, attempt);
          setStreamTextState(
            prefix +
              `\n⏳ ${e?.message || 'Lỗi kết nối'} — tự kết nối lại (lần ${attempt + 1}/${MAX_RETRIES}), chờ ${Math.round(wait / 1000)}s…`
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
        
        if (finishReason === 'abort') {
          combined += '\n[CẢNH BÁO: Đã huỷ yêu cầu bởi người dùng]';
          break;
        }

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
    } catch (e: any) {
      logError(e);
      addItem('system', `⚠️ Lỗi: ${e?.message || ''}. Kiểm tra error.log để xem chi tiết.`);
    } finally {
      setIsLoading(false);
      setStreamTextState('');
      setToolStatus('');
      setActiveTools([]);
    }
  };

  return {
    items, addItem,
    isLoading, streamTextState, toolStatus, activeTools,
    pendingApproval, setPendingApproval,
    submitChat, abort
  };
}

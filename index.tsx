import React, { useEffect, useMemo, useState } from 'react';
import { render, Text, Box, useApp, useInput, Static } from 'ink';
import { config as loadEnv } from 'dotenv';
import { loadConfig, saveConfig, type AppConfig } from './config';
import {
  fetchModels,
  fetchModelCapabilities,
  DEFAULT_CAPABILITIES,
  type ModelInfo,
  type ModelCapabilities,
} from './openrouter';

import Spinner from 'ink-spinner';
import { MessageView } from './components/MessageView';
import { Settings } from './components/Settings';
import { ChatInput } from './components/ChatInput';
import { useChat } from './hooks/useChat';
import { useFilePicker } from './hooks/useFilePicker';
import { restoreLatestBackup } from './tools';

loadEnv();

const HELP_TEXT =
  'Các lệnh:\n' +
  '  /help            – xem trợ giúp này\n' +
  '  /models          – chọn model từ danh sách OpenRouter (live)\n' +
  '  /model <id>      – đổi nhanh sang model theo id\n' +
  '  /key <api-key>   – đặt API key OpenRouter\n' +
  '  /settings        – mở bảng cài đặt (hoặc nhấn Ctrl+S)\n' +
  '  /undo            – khôi phục file vừa sửa/xóa gần nhất\n' +
  '  exit             – thoát';

type Mode = 'chat' | 'settings' | 'editKey' | 'picker';

const App = ({ initialConfig }: { initialConfig: AppConfig }) => {
  const { exit } = useApp();
  const [cfg, setCfg] = useState<AppConfig>(initialConfig);
  const [mode, setMode] = useState<Mode>('chat');
  const [keyDraft, setKeyDraft] = useState('');
  const [capabilities, setCapabilities] = useState<ModelCapabilities>(DEFAULT_CAPABILITIES);

  // Tải capability (modalities + tools) của model hiện tại để tối ưu request.
  // Lỗi mạng → giữ mặc định an toàn (tools bật, ảnh tắt) để không phá luồng chat.
  useEffect(() => {
    let cancelled = false;
    fetchModelCapabilities(cfg.baseURL, cfg.model)
      .then((caps) => { if (!cancelled) setCapabilities(caps); })
      .catch(() => { if (!cancelled) setCapabilities(DEFAULT_CAPABILITIES); });
    return () => { cancelled = true; };
  }, [cfg.baseURL, cfg.model]);

  const applyCfg = async (next: AppConfig) => {
    setCfg(next);
    await saveConfig(next);
  };

  const {
    items, addItem,
    isLoading, streamTextState, toolStatus, activeTools,
    reasoningState, stepState,
    pendingApproval, setPendingApproval,
    submitChat, abort
  } = useChat(cfg, capabilities);

  const {
    input, setInput, handleInputChange,
    atActive, atQuery, atFiltered,
    atCursor, setAtCursor,
    attachments, setAttachments,
    selectFile, isScanning
  } = useFilePicker(mode, isLoading, !!pendingApproval);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState(0);

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

  useInput(
    (char, key) => {
      if (key.ctrl && char === 's') setMode('settings');
      if (key.ctrl && char === 'c' && isLoading) abort();
    },
    { isActive: mode === 'chat' && !pendingApproval }
  );

  useInput(
    (char, key) => {
      const c = char.toLowerCase();
      if (c === 'y') {
        pendingApproval?.resolveAll(true);
      } else if (c === 'n' || key.escape) {
        pendingApproval?.resolveAll(false);
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
    if (atActive) {
      const f = atFiltered[atCursor];
      if (f) selectFile(f, true);
      return;
    }
    const text = input.trim();
    setInput('');
    if (!text) return;

    if (text === 'exit' || text === '/exit' || text === '/quit') return exit();
    if (text === '/help') return addItem('system', HELP_TEXT);
    if (text === '/undo') {
      const result = await restoreLatestBackup();
      return addItem('system', result);
    }
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

    submitChat(text, attachments, () => setAttachments([]));
  };

  const WINDOW = 10;
  const start = Math.max(0, Math.min(cursor - Math.floor(WINDOW / 2), Math.max(0, filtered.length - WINDOW)));
  const windowed = filtered.slice(start, start + WINDOW);

  const AT_WINDOW = 8;
  const atStart = Math.max(0, Math.min(atCursor - Math.floor(AT_WINDOW / 2), Math.max(0, atFiltered.length - AT_WINDOW)));
  const atWindowed = atFiltered.slice(atStart, atStart + AT_WINDOW);

  const reasoningView = reasoningState.length > 1200 ? '…' + reasoningState.slice(-1200) : reasoningState;

  return (
    <Box flexDirection="column">
      <Static items={items}>{(item) => <MessageView key={item.id} item={item} />}</Static>

      {isLoading && !pendingApproval && (stepState || reasoningState) && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan">
            <Spinner type="dots" /> <Text italic>{stepState || 'Đang suy nghĩ…'}</Text>
          </Text>
          {reasoningState && (
            <Box marginLeft={2}>
              <Text dimColor italic>💭 {reasoningView}</Text>
            </Box>
          )}
        </Box>
      )}

      {streamTextState && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            🎩 Quản gia AI{' '}
            {isLoading && !pendingApproval && <Text color="yellow"><Spinner type="dots" /></Text>}
          </Text>
          <Text>{streamTextState}</Text>
        </Box>
      )}

      {isLoading && !streamTextState && !reasoningState && !stepState && !pendingApproval && (
        <Box flexDirection="column">
          <Text color="yellow">
            <Spinner type="dots" /> <Text italic>Quản gia đang suy nghĩ …</Text>
          </Text>
        </Box>
      )}

      {activeTools && activeTools.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {activeTools.map((t) => (
             <Box key={t.id} flexDirection="row">
               <Text color={t.status === 'done' ? 'green' : 'yellow'}>
                 {t.status === 'done' ? '✓ ' : '⏳ '} 
               </Text>
               <Text dimColor>
                 {t.name}({JSON.stringify(t.args).slice(0, 60)}{JSON.stringify(t.args).length > 60 ? '...' : ''})
               </Text>
             </Box>
          ))}
          {toolStatus && <Text dimColor>{toolStatus}</Text>}
        </Box>
      )}

      {pendingApproval && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginBottom={1}>
          <Text bold color="yellow">⚠️ AI đề xuất {pendingApproval.items.length} hành động:</Text>
          {pendingApproval.items.map((item, idx) => {
            const isDiff = item.data?.type === 'diff';
            return (
              <Box key={idx} flexDirection="column" marginLeft={1} marginTop={1}>
                <Text bold color="cyan">• {item.title}</Text>
                {!isDiff && <Text dimColor>{item.detail}</Text>}
                {isDiff && (
                  <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
                     {item.data.searchBlock.split('\n').map((l: string, i: number) => <Text key={`o-${i}`} color="red">- {l}</Text>)}
                     {item.data.replaceBlock.split('\n').map((l: string, i: number) => <Text key={`n-${i}`} color="green">+ {l}</Text>)}
                  </Box>
                )}
              </Box>
            );
          })}
          <Box marginTop={1}>
             <Text bold color="cyan">→ [Y] PHÊ DUYỆT TẤT CẢ · [N] TỪ CHỐI</Text>
          </Box>
        </Box>
      )}

      <Settings
        mode={mode}
        cfg={cfg}
        keyDraft={keyDraft}
        setKeyDraft={setKeyDraft}
        applyCfg={applyCfg}
        setMode={setMode}
        addItem={addItem}
      />

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

      {mode === 'chat' && !pendingApproval && !isLoading && (
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          atActive={atActive}
          isScanning={isScanning}
          atQuery={atQuery}
          atFiltered={atFiltered}
          atWindowed={atWindowed}
          atStart={atStart}
          atCursor={atCursor}
          attachments={attachments}
          model={cfg.model}
          capabilities={capabilities}
        />
      )}
    </Box>
  );
};

async function main() {
  console.log('🤖 Agentic Terminal — Dành riêng cho Cậu chủ Đăng\n');
  const initialConfig = await loadConfig();
  render(<App initialConfig={initialConfig} />);
}

main();

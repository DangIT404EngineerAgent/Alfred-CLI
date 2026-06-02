import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { maskKey } from '../utils/format';

type SettingsProps = {
  mode: string;
  cfg: any;
  keyDraft: string;
  setKeyDraft: (v: string) => void;
  applyCfg: (v: any) => void;
  setMode: (m: any) => void;
  addItem: (role: any, msg: string) => void;
};

export function Settings({ mode, cfg, keyDraft, setKeyDraft, applyCfg, setMode, addItem }: SettingsProps) {
  if (mode === 'settings') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">⚙️  Cài đặt (OpenRouter)</Text>
        <Text>API key : {maskKey(cfg.apiKey)}</Text>
        <Text>Base URL: {cfg.baseURL}</Text>
        <Text>Model   : {cfg.model}</Text>
        <Text dimColor>[M] đổi model · [K] nhập API key · [Esc] đóng</Text>
      </Box>
    );
  }

  if (mode === 'editKey') {
    return (
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
    );
  }

  return null;
}

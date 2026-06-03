import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { type ModelCapabilities } from '../openrouter';

type ChatInputProps = {
  input: string;
  handleInputChange: (v: string) => void;
  handleSubmit: () => void;
  atActive: boolean;
  isScanning: boolean;
  atQuery: string;
  atFiltered: string[];
  atWindowed: string[];
  atStart: number;
  atCursor: number;
  attachments: { path: string; inline: boolean }[];
  model: string;
  capabilities: ModelCapabilities;
};

export function ChatInput({
  input, handleInputChange, handleSubmit,
  atActive, isScanning, atQuery, atFiltered, atWindowed, atStart, atCursor,
  attachments, model, capabilities
}: ChatInputProps) {
  const caps = [
    '📝 text',
    capabilities.supportsImage ? '🖼️ image' : null,
    capabilities.supportsTools ? '🔧 tools' : null,
  ].filter(Boolean).join(' · ');
  return (
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

      {atActive && (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
          <Text bold color="magenta">📎 Gắn file — gõ để lọc · ↑↓ chọn · Enter kèm nội dung · Tab chỉ gắn thẻ</Text>
          {isScanning ? (
            <Text color="yellow">Đang quét thư mục dự án…</Text>
          ) : (
            <>
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
            </>
          )}
        </Box>
      )}

      {attachments.length > 0 && (
        <Text dimColor>
          📎 {attachments.map((a) => `@${a.path}${a.inline ? ' (nội dung)' : ' (thẻ)'}`).join('  ·  ')}
        </Text>
      )}

      <Text dimColor>Model: {model}  ·  {caps}</Text>
      <Text dimColor>@ gắn file · /help · /models · Ctrl+S cài đặt</Text>
    </Box>
  );
}

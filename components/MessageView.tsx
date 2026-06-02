import React from 'react';
import { Box, Text } from 'ink';
import { renderMarkdown } from '../utils/format';

export type Item = { id: number; role: 'user' | 'assistant' | 'system'; content: string; attachments?: string[] };

export function MessageView({ item }: { item: Item }) {
  const { role } = item;
  const label = role === 'user' ? '👨‍💻 Cậu chủ' : role === 'system' ? 'ℹ️  Hệ thống' : '🎩 Quản gia AI';
  const color = role === 'user' ? 'blue' : role === 'system' ? 'yellow' : 'green';
  const content = role === 'assistant' ? renderMarkdown(item.content) : item.content;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>{label}</Text>
      {item.attachments && item.attachments.length > 0 && (
        <Text dimColor>📎 Đã đính kèm: {item.attachments.join(', ')}</Text>
      )}
      <Text>{content}</Text>
    </Box>
  );
}

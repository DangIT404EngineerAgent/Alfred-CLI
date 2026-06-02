import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

const TERM_WIDTH = Math.min(100, (process.stdout.columns || 80) - 2);
marked.use(markedTerminal({ width: TERM_WIDTH, reflowText: true }) as any);

export function renderMarkdown(text: string): string {
  try {
    return (marked.parse(text) as string).replace(/\n+$/, '');
  } catch {
    return text;
  }
}

export function maskKey(k: string): string {
  if (k.length <= 12) return k ? '••••' : '(chưa có)';
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

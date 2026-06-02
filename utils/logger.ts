import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function logError(err: any) {
  try {
    const dir = join(homedir(), '.terminalai');
    mkdirSync(dir, { recursive: true });
    const message = err instanceof Error ? err.stack || err.message : String(err);
    appendFileSync(join(dir, 'error.log'), `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {}
}

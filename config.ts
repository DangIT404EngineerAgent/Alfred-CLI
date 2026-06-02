import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.terminalai');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export type AppConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

const DEFAULTS = {
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'moonshotai/kimi-k2.6:free',
};

// Đọc config: ưu tiên config.json, fallback về biến môi trường (.env), cuối cùng là mặc định.
export function loadConfig(): AppConfig {
  let file: Partial<AppConfig> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      file = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      file = {};
    }
  }
  return {
    apiKey: file.apiKey || process.env.OPENAI_API_KEY || '',
    baseURL: file.baseURL || process.env.OPENAI_BASE_URL || DEFAULTS.baseURL,
    model: file.model || process.env.MODEL_ID || DEFAULTS.model,
  };
}

export function saveConfig(cfg: AppConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

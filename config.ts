import { readFile, writeFile, mkdir } from 'fs/promises';
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
export async function loadConfig(): Promise<AppConfig> {
  let file: Partial<AppConfig> = {};
  try {
    const data = await readFile(CONFIG_PATH, 'utf8');
    file = JSON.parse(data);
  } catch {
    // File không tồn tại hoặc parse lỗi, sử dụng file = {}
    file = {};
  }
  return {
    apiKey: file.apiKey || process.env.OPENAI_API_KEY || '',
    baseURL: file.baseURL || process.env.OPENAI_BASE_URL || DEFAULTS.baseURL,
    model: file.model || process.env.MODEL_ID || DEFAULTS.model,
  };
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

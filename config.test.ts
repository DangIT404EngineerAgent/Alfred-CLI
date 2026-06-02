import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock the modules BEFORE importing the config module
// so that when config.ts is imported and its top level code runs, it uses the mocked homedir.
vi.mock('fs', () => {
  const m = {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    existsSync: vi.fn()
  };
  return {
    ...m,
    default: m
  };
});

vi.mock('os', () => {
  const m = {
    homedir: vi.fn(() => '/mocked/home/dir'),
  };
  return {
    ...m,
    default: m
  };
});

// Import after mocking
import { loadConfig, saveConfig, AppConfig } from './config';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.MODEL_ID;
  });

  describe('loadConfig', () => {
    it('should return default config if file does not exist and no env vars', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: '',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6:free',
      });
    });

    it('should load config from file if it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
        model: 'file-model',
      }));

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
        model: 'file-model',
      });
    });

    it('should fallback to env vars if file values are missing', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        // missing values
      }));

      process.env.OPENAI_API_KEY = 'env-key';
      process.env.OPENAI_BASE_URL = 'https://env.url';
      process.env.MODEL_ID = 'env-model';

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'env-key',
        baseURL: 'https://env.url',
        model: 'env-model',
      });
    });

    it('should fallback to env vars and defaults if file contains invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      process.env.OPENAI_API_KEY = 'env-key';

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'env-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6:free',
      });
    });

    it('should prioritize file config over env vars', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
      }));

      process.env.OPENAI_API_KEY = 'env-key';
      process.env.OPENAI_BASE_URL = 'https://env.url';
      process.env.MODEL_ID = 'env-model';

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
        model: 'env-model',
      });
    });
  });

  describe('saveConfig', () => {
    it('should create the config directory recursively and save the config file', () => {
      const mockConfig: AppConfig = {
        apiKey: 'test-key',
        baseURL: 'https://test.url',
        model: 'test-model',
      };

      saveConfig(mockConfig);

      const expectedConfigDir = path.join('/mocked/home/dir', '.terminalai');
      const expectedConfigPath = path.join(expectedConfigDir, 'config.json');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedConfigDir, { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedConfigPath,
        JSON.stringify(mockConfig, null, 2),
        'utf8'
      );
    });
  });
});

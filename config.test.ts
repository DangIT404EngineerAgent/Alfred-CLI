import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock the modules BEFORE importing the config module
// so that when config.ts is imported and its top level code runs, it uses the mocked homedir.
vi.mock('fs/promises', () => {
  const m = {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
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
import { readFile, mkdir, writeFile } from 'fs/promises';
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
    it('should return default config if file does not exist and no env vars', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      const config = await loadConfig();

      expect(config).toEqual({
        apiKey: '',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6:free',
      });
    });

    it('should load config from file if it exists', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
        model: 'file-model',
      }));

      const config = await loadConfig();

      expect(config).toEqual({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
        model: 'file-model',
      });
    });

    it('should fallback to env vars if file values are missing', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        // missing values
      }));

      process.env.OPENAI_API_KEY = 'env-key';
      process.env.OPENAI_BASE_URL = 'https://env.url';
      process.env.MODEL_ID = 'env-model';

      const config = await loadConfig();

      expect(config).toEqual({
        apiKey: 'env-key',
        baseURL: 'https://env.url',
        model: 'env-model',
      });
    });

    it('should fallback to env vars and defaults if file contains invalid JSON', async () => {
      vi.mocked(readFile).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      process.env.OPENAI_API_KEY = 'env-key';

      const config = await loadConfig();

      expect(config).toEqual({
        apiKey: 'env-key',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6:free',
      });
    });

    it('should prioritize file config over env vars', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
      }));

      process.env.OPENAI_API_KEY = 'env-key';
      process.env.OPENAI_BASE_URL = 'https://env.url';
      process.env.MODEL_ID = 'env-model';

      const config = await loadConfig();

      expect(config).toEqual({
        apiKey: 'file-key',
        baseURL: 'https://file.url',
        model: 'env-model',
      });
    });
  });

  describe('saveConfig', () => {
    it('should create the config directory recursively and save the config file', async () => {
      const mockConfig: AppConfig = {
        apiKey: 'test-key',
        baseURL: 'https://test.url',
        model: 'test-model',
      };

      await saveConfig(mockConfig);

      const expectedConfigDir = path.join('/mocked/home/dir', '.terminalai');
      const expectedConfigPath = path.join(expectedConfigDir, 'config.json');

      expect(mkdir).toHaveBeenCalledWith(expectedConfigDir, { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        expectedConfigPath,
        JSON.stringify(mockConfig, null, 2),
        'utf8'
      );
    });
  });
});

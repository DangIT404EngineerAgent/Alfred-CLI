import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { saveConfig, loadConfig, AppConfig } from './config';

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = process.env;
      process.env = { ...originalEnv };
      // Clear relevant env vars
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_BASE_URL;
      delete process.env.MODEL_ID;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return defaults when file does not exist and env vars are not set', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: '',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6:free',
      });
      expect(fs.existsSync).toHaveBeenCalledWith(path.join('/mocked/home/dir', '.terminalai', 'config.json'));
    });

    it('should return env var values when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'env-api-key';
      process.env.OPENAI_BASE_URL = 'https://env.url';
      process.env.MODEL_ID = 'env-model';

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'env-api-key',
        baseURL: 'https://env.url',
        model: 'env-model',
      });
    });

    it('should fallback to defaults/env vars if config file contains invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid-json');

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: '',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6:free',
      });
    });

    it('should return config file values over env vars', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        apiKey: 'file-api-key',
        baseURL: 'https://file.url',
        model: 'file-model',
      }));

      process.env.OPENAI_API_KEY = 'env-api-key';
      process.env.OPENAI_BASE_URL = 'https://env.url';
      process.env.MODEL_ID = 'env-model';

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'file-api-key',
        baseURL: 'https://file.url',
        model: 'file-model',
      });
    });

    it('should merge config file values with env vars correctly', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        apiKey: 'file-api-key',
      }));

      process.env.OPENAI_BASE_URL = 'https://env.url';

      const config = loadConfig();

      expect(config).toEqual({
        apiKey: 'file-api-key',
        baseURL: 'https://env.url',
        model: 'moonshotai/kimi-k2.6:free',
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

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
import { saveConfig, AppConfig } from './config';

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

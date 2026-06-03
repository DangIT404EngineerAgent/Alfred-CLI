import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchModels } from './openrouter';

describe('fetchModels', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should throw an error if the response is not ok', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchModels('https://api.test.com')).rejects.toThrow('HTTP 500');
  });

  it('should return a sorted array of ModelInfo on success', async () => {
    const mockData = {
      data: [
        { id: 'model-a', name: 'Model A', pricing: { prompt: '0.1' } },
        { id: 'model-b:free', name: 'Model B', pricing: { prompt: '0' } },
        { id: 'model-c', name: 'Model C', pricing: { prompt: '0.0' } },
        { id: 'model-d:free', name: 'Model D' },
        { id: 'model-e', pricing: { prompt: '0.2' } }, // no name, fallback to id
        { id: 'model-f', name: 'Model F', pricing: { prompt: '0.3' } }, // for sorting comparison with model-a and model-e
      ]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const models = await fetchModels('https://api.test.com/');

    expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/models');

    expect(models).toEqual([
      { id: 'model-b:free', name: 'Model B', free: true },
      { id: 'model-c', name: 'Model C', free: true },
      { id: 'model-d:free', name: 'Model D', free: true },
      { id: 'model-a', name: 'Model A', free: false },
      { id: 'model-e', name: 'model-e', free: false },
      { id: 'model-f', name: 'Model F', free: false },
    ]);
  });

  it('should handle undefined json gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: undefined }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([]);
  });

  it('should handle empty data gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([]);
  });
});

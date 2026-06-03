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
    ]);
  });

  it('should handle empty data gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([]);
  });

  it('should handle missing prompt price but match :free in id', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'model:free', name: 'Free Model', pricing: {} }]
      }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([
      { id: 'model:free', name: 'Free Model', free: true },
    ]);
  });

  it('should handle equal free status and exact same id gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'same-model', name: 'Model A' },
          { id: 'same-model', name: 'Model B' },
        ]
      }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([
      { id: 'same-model', name: 'Model A', free: false },
      { id: 'same-model', name: 'Model B', free: false },
    ]);
  });

  it('should handle opposite sorting scenario: b.free and not a.free', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'model-b', name: 'Model B', pricing: { prompt: '0.1' } },
          { id: 'model-a:free', name: 'Model A' },
        ]
      }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([
      { id: 'model-a:free', name: 'Model A', free: true },
      { id: 'model-b', name: 'Model B', free: false },
    ]);
  });

  it('should handle reverse sorting order where a non-free model is compared to a free model', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'model-a:free', name: 'Model A' },
          { id: 'model-b', name: 'Model B', pricing: { prompt: '0.1' } },
        ]
      }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([
      { id: 'model-a:free', name: 'Model A', free: true },
      { id: 'model-b', name: 'Model B', free: false },
    ]);
  });

  it('should handle cases where json.data is absent', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([]);
  });

  it('should default name to id if name is missing', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'model-no-name' }]
      }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([
      { id: 'model-no-name', name: 'model-no-name', free: false },
    ]);
  });

  it('should correctly sort models: free models first, then non-free, alphabetically by id', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'z-paid', name: 'Z Paid', pricing: { prompt: '0.1' } },
          { id: 'a-paid', name: 'A Paid', pricing: { prompt: '0.1' } },
          { id: 'z-free:free', name: 'Z Free' },
          { id: 'a-free:free', name: 'A Free' },
        ]
      }),
    });

    const models = await fetchModels('https://api.test.com');
    expect(models).toEqual([
      { id: 'a-free:free', name: 'A Free', free: true },
      { id: 'z-free:free', name: 'Z Free', free: true },
      { id: 'a-paid', name: 'A Paid', free: false },
      { id: 'z-paid', name: 'Z Paid', free: false },
    ]);
  });
});

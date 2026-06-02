export type ModelInfo = {
  id: string;
  name: string;
  free: boolean;
};

// Lấy danh sách model trực tiếp từ OpenRouter (endpoint /models không cần API key).
export async function fetchModels(baseURL: string): Promise<ModelInfo[]> {
  const url = `${baseURL.replace(/\/$/, '')}/models`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: any = await res.json();
  const data: any[] = json.data || [];
  return data
    .map((m) => {
      const promptPrice = m.pricing?.prompt;
      const free = promptPrice === '0' || promptPrice === '0.0' || /:free$/.test(m.id);
      return { id: m.id as string, name: (m.name as string) || m.id, free };
    })
    .sort((a, b) => (a.free === b.free ? a.id.localeCompare(b.id) : a.free ? -1 : 1));
}

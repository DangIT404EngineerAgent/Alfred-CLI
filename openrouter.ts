export type ModelInfo = {
  id: string;
  name: string;
  free: boolean;
};

// Khả năng (modalities) của một model: dùng để tối ưu request theo từng model.
export type ModelCapabilities = {
  inputModalities: string[];   // ví dụ ['text', 'image']
  outputModalities: string[];  // ví dụ ['text']
  supportsTools: boolean;      // có function calling không
  supportsImage: boolean;      // có nhận ảnh đầu vào không
  supportsReasoning: boolean;  // có trả chuỗi suy luận (reasoning tokens) không
};

// Mặc định an toàn khi chưa/không lấy được capability: giữ hành vi agentic (tools bật),
// coi như chỉ nhận text cho tới khi biết chắc model hỗ trợ ảnh.
export const DEFAULT_CAPABILITIES: ModelCapabilities = {
  inputModalities: ['text'],
  outputModalities: ['text'],
  supportsTools: true,
  supportsImage: false,
  supportsReasoning: false,
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

// Lấy capability của riêng model đang dùng (đọc lại /models, không cần API key).
// Model không nằm trong danh sách → trả mặc định để giữ hành vi hiện tại.
export async function fetchModelCapabilities(
  baseURL: string,
  modelId: string
): Promise<ModelCapabilities> {
  const url = `${baseURL.replace(/\/$/, '')}/models`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: any = await res.json();
  const data: any[] = json.data || [];
  const m = data.find((x) => x.id === modelId);
  if (!m) return DEFAULT_CAPABILITIES;
  const inputModalities: string[] = m.architecture?.input_modalities || ['text'];
  const outputModalities: string[] = m.architecture?.output_modalities || ['text'];
  const params: string[] = m.supported_parameters || [];
  return {
    inputModalities,
    outputModalities,
    supportsTools: params.includes('tools'),
    supportsImage: inputModalities.includes('image'),
    supportsReasoning: params.includes('reasoning') || params.includes('include_reasoning'),
  };
}

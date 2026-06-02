#!/usr/bin/env node
import { tsImport } from 'tsx/esm/api';

// Chạy index.tsx (TypeScript/TSX) ngay trong process này, không cần build trước.
// Specifier tương đối -> resolve theo vị trí cli.mjs, không phụ thuộc thư mục đang đứng.
await tsImport('./index.tsx', import.meta.url);

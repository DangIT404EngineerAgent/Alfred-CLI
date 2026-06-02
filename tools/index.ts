import { z } from 'zod';
import { tool } from 'ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { scanFiles } from '../utils/fs';

const execAsync = promisify(exec);

export type ApprovalRequest = (title: string, detail: string) => Promise<boolean>;

export function createTools(requestApproval: ApprovalRequest) {
  return {
    runShell: tool({
      description: 'Chạy một câu lệnh terminal (bash/zsh) để kiểm tra log, test code, xem git status, v.v.',
      parameters: z.object({ command: z.string().describe('Câu lệnh cần chạy') }),
      execute: async ({ command }) => {
        if (!(await requestApproval('Chạy lệnh shell', command))) return 'Người dùng đã TỪ CHỐI chạy lệnh này.';
        try {
          const { stdout, stderr } = await execAsync(command, { timeout: 60000, maxBuffer: 1024 * 1024 });
          return (stdout || '') + (stderr ? `\n[stderr]\n${stderr}` : '') || '(không có output)';
        } catch (e: any) {
          return `Lỗi: ${e.message}\n${e.stdout || ''}${e.stderr || ''}`;
        }
      },
    }),
    readFile: tool({
      description: 'Đọc nội dung một file để xem code hoặc dữ liệu.',
      parameters: z.object({ path: z.string().describe('Đường dẫn file cần đọc') }),
      execute: async ({ path }) => {
        try {
          const content = readFileSync(path, 'utf8');
          const MAX_SIZE = 50 * 1024; // 50KB
          if (content.length > MAX_SIZE) {
            return content.slice(0, MAX_SIZE) + `\n\n[CẢNH BÁO: File quá lớn (${Math.round(content.length / 1024)}KB). Đã cắt gọn còn 50KB để tránh tràn bộ nhớ.]`;
          }
          return content;
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      },
    }),
    writeFile: tool({
      description: 'Ghi/đè nội dung vào một file (tạo mới hoặc thay thế toàn bộ).',
      parameters: z.object({
        path: z.string().describe('Đường dẫn file cần ghi'),
        content: z.string().describe('Nội dung đầy đủ sẽ ghi vào file'),
      }),
      execute: async ({ path, content }) => {
        const preview = content.length > 500 ? content.slice(0, 500) + '\n... (đã rút gọn)' : content;
        if (!(await requestApproval(`Ghi file: ${path}`, preview))) return 'Người dùng đã TỪ CHỐI ghi file này.';
        try {
          writeFileSync(path, content, 'utf8');
          return `Đã ghi xong file: ${path}`;
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      },
    }),
    replaceInFile: tool({
      description: 'Tìm và thay thế một đoạn text trong file. Dùng để sửa code mà không cần in lại cả file.',
      parameters: z.object({
        path: z.string().describe('Đường dẫn file cần sửa'),
        oldText: z.string().describe('Đoạn text cũ cần tìm (phải khớp chính xác hoàn toàn)'),
        newText: z.string().describe('Đoạn text mới sẽ thay thế vào'),
      }),
      execute: async ({ path, oldText, newText }) => {
        const preview = `Thay thế:\n${oldText}\n\nThành:\n${newText}`;
        if (!(await requestApproval(`Sửa file: ${path}`, preview))) return 'Người dùng đã TỪ CHỐI sửa file này.';
        try {
          const content = readFileSync(path, 'utf8');
          if (!content.includes(oldText)) {
            return `Lỗi: Không tìm thấy đoạn text cũ trong file. Vui lòng kiểm tra lại sự chính xác của text (khoảng trắng, xuống dòng...).`;
          }
          const updated = content.replace(oldText, newText);
          writeFileSync(path, updated, 'utf8');
          return `Đã sửa xong file: ${path}`;
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      },
    }),
    searchProject: tool({
      description: 'Dò tìm một từ khoá trong toàn bộ project (trừ các file bị bỏ qua bởi .gitignore).',
      parameters: z.object({
        keyword: z.string().describe('Từ khoá cần tìm'),
      }),
      execute: async ({ keyword }) => {
        try {
          const files = await scanFiles(process.cwd());
          const results: string[] = [];
          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf8');
              if (content.includes(keyword)) {
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                  if (line.includes(keyword)) {
                    results.push(`${file}:${idx + 1}: ${line.trim().slice(0, 100)}`);
                  }
                });
              }
            } catch (e) {
              // skip unreadable files
            }
          }
          if (results.length === 0) return `Không tìm thấy "${keyword}" trong project.`;
          const limited = results.slice(0, 50);
          return limited.join('\n') + (results.length > 50 ? `\n\n... (đã ẩn ${results.length - 50} kết quả)` : '');
        } catch (e: any) {
          return `Lỗi quét file: ${e.message}`;
        }
      },
    }),
  };
}

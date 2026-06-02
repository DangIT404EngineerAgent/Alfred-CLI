import { z } from 'zod';
import { tool } from 'ai';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync } from 'fs';
import { scanFiles } from '../utils/fs';

export type ApprovalRequest = (title: string, detail: string) => Promise<boolean>;

export function createTools(requestApproval: ApprovalRequest) {
  return {
    runShell: tool({
      description: 'Chạy một câu lệnh terminal (bash/zsh) để kiểm tra log, test code, xem git status, v.v.',
      parameters: z.object({ command: z.string().describe('Câu lệnh cần chạy') }),
      execute: async ({ command }) => {
        if (!(await requestApproval('Chạy lệnh shell', command))) return 'Người dùng đã TỪ CHỐI chạy lệnh này.';
        try {
          return await new Promise((resolve) => {
            const child = spawn(command, { shell: true });
            let output = '';
            
            child.stdout.on('data', (data: Buffer) => {
               const str = data.toString();
               output += str;
               if (str.trim()) console.log(str.trim());
            });
            child.stderr.on('data', (data: Buffer) => {
               const str = data.toString();
               output += str;
               if (str.trim()) console.error(str.trim());
            });
            child.on('close', (code: number) => {
               resolve(output || '(không có output)');
            });
            child.on('error', (err: Error) => {
               resolve(`Lỗi khi chạy lệnh: ${err.message}\n${output}`);
            });
          });
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
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
      description: 'Thay thế một phạm vi các dòng trong file bằng code mới. Hữu ích để sửa code an toàn mà không bị lỗi thụt lề.',
      parameters: z.object({
        path: z.string().describe('Đường dẫn file cần sửa'),
        startLine: z.number().describe('Dòng bắt đầu cần thay thế (1-indexed)'),
        endLine: z.number().describe('Dòng kết thúc cần thay thế (1-indexed, đã bao gồm dòng này)'),
        newText: z.string().describe('Đoạn code mới sẽ chèn vào thay thế cho các dòng trên'),
      }),
      execute: async ({ path, startLine, endLine, newText }) => {
        const preview = `Thay thế từ dòng ${startLine} đến ${endLine} thành:\n${newText}`;
        if (!(await requestApproval(`Sửa file: ${path}`, preview))) return 'Người dùng đã TỪ CHỐI sửa file này.';
        try {
          const content = readFileSync(path, 'utf8');
          const lines = content.split('\n');
          if (startLine < 1 || endLine > lines.length || startLine > endLine) {
            return `Lỗi: Dòng không hợp lệ. File có ${lines.length} dòng.`;
          }
          lines.splice(startLine - 1, endLine - startLine + 1, newText);
          writeFileSync(path, lines.join('\n'), 'utf8');
          return `Đã sửa xong file: ${path}`;
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      },
    }),
    listDirectory: tool({
      description: 'Liệt kê các file và thư mục con trong một thư mục.',
      parameters: z.object({ path: z.string().describe('Đường dẫn thư mục cần liệt kê') }),
      execute: async ({ path }) => {
        try {
          const entries = readdirSync(path);
          const results = entries.map(entry => {
             const fullPath = `${path}/${entry}`;
             try {
                const isDir = statSync(fullPath).isDirectory();
                return isDir ? `${entry}/` : entry;
             } catch(e) { return entry; }
          });
          return results.join('\n');
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      }
    }),
    createDirectory: tool({
      description: 'Tạo một thư mục mới.',
      parameters: z.object({ path: z.string().describe('Đường dẫn thư mục cần tạo') }),
      execute: async ({ path }) => {
        try {
          mkdirSync(path, { recursive: true });
          return `Đã tạo thư mục: ${path}`;
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      }
    }),
    deleteFile: tool({
      description: 'Xóa một file hoặc thư mục (xóa đệ quy).',
      parameters: z.object({ path: z.string().describe('Đường dẫn file hoặc thư mục cần xóa') }),
      execute: async ({ path }) => {
         if (!(await requestApproval(`Xóa file/thư mục: ${path}`, 'Bạn có chắc chắn muốn xóa?'))) return 'Người dùng đã TỪ CHỐI xóa.';
         try {
           rmSync(path, { recursive: true, force: true });
           return `Đã xóa: ${path}`;
         } catch (e: any) {
           return `Lỗi: ${e.message}`;
         }
      }
    }),
    getFileMetadata: tool({
      description: 'Lấy thông tin metadata của một file (kích thước, thời gian).',
      parameters: z.object({ path: z.string().describe('Đường dẫn file') }),
      execute: async ({ path }) => {
        try {
          const stat = statSync(path);
          return `Kích thước: ${stat.size} bytes\nTạo lúc: ${stat.birthtime}\nSửa lúc: ${stat.mtime}\nLà thư mục: ${stat.isDirectory()}`;
        } catch (e: any) {
          return `Lỗi: ${e.message}`;
        }
      }
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

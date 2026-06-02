import { z } from 'zod';
import { tool } from 'ai';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync } from 'fs';
import { scanFiles } from '../utils/fs';

export type ApprovalRequest = (title: string, detail: string) => Promise<boolean>;

export function createTools(
  requestApproval: ApprovalRequest,
  onToolStatus: (msg: string) => void
) {
  return {
    runShell: tool({
      description: 'Chạy một câu lệnh terminal (bash/zsh) để kiểm tra log, test code, xem git status, v.v.',
      parameters: z.object({ command: z.string().describe('Câu lệnh cần chạy') }),
      execute: async ({ command }) => {
        onToolStatus(`⚙️ Đang chạy lệnh: ${command}`);
        if (!(await requestApproval('Chạy lệnh shell', command))) {
          onToolStatus('');
          return 'Người dùng đã TỪ CHỐI chạy lệnh này.';
        }
        try {
          return await new Promise((resolve) => {
            const child = spawn(command, { shell: true });
            let output = '';
            
            child.stdout.on('data', (data: Buffer) => {
               const str = data.toString();
               output += str;
               if (str.trim()) onToolStatus(`[shell] ${str.trim().slice(-100)}`);
            });
            child.stderr.on('data', (data: Buffer) => {
               const str = data.toString();
               output += str;
               if (str.trim()) onToolStatus(`[shell] ${str.trim().slice(-100)}`);
            });
            child.on('close', (code: number) => {
               onToolStatus('');
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
        onToolStatus(`⚙️ Đang đọc file: ${path}`);
        try {
          const content = readFileSync(path, 'utf8');
          const MAX_SIZE = 50 * 1024; // 50KB
          let result = content;
          if (content.length > MAX_SIZE) {
            result = content.slice(0, MAX_SIZE) + `\n\n[CẢNH BÁO: File quá lớn (${Math.round(content.length / 1024)}KB). Đã cắt gọn còn 50KB để tránh tràn bộ nhớ.]`;
          }
          onToolStatus('');
          return result;
        } catch (e: any) {
          onToolStatus('');
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
        onToolStatus(`⚙️ Đang yêu cầu ghi file: ${path}`);
        const preview = content.length > 500 ? content.slice(0, 500) + '\n... (đã rút gọn)' : content;
        if (!(await requestApproval(`Ghi file: ${path}`, preview))) {
          onToolStatus('');
          return 'Người dùng đã TỪ CHỐI ghi file này.';
        }
        onToolStatus(`⚙️ Đang ghi file: ${path}`);
        try {
          writeFileSync(path, content, 'utf8');
          onToolStatus('');
          return `Đã ghi xong file: ${path}`;
        } catch (e: any) {
          onToolStatus('');
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
        onToolStatus(`⚙️ Đang yêu cầu sửa file: ${path}`);
        const preview = `Thay thế từ dòng ${startLine} đến ${endLine} thành:\n${newText}`;
        if (!(await requestApproval(`Sửa file: ${path}`, preview))) {
          onToolStatus('');
          return 'Người dùng đã TỪ CHỐI sửa file này.';
        }
        onToolStatus(`⚙️ Đang sửa file: ${path}`);
        try {
          const content = readFileSync(path, 'utf8');
          const lines = content.split('\n');
          if (startLine < 1 || endLine > lines.length || startLine > endLine) {
            onToolStatus('');
            return `Lỗi: Dòng không hợp lệ. File có ${lines.length} dòng.`;
          }
          lines.splice(startLine - 1, endLine - startLine + 1, newText);
          writeFileSync(path, lines.join('\n'), 'utf8');
          onToolStatus('');
          return `Đã sửa xong file: ${path}`;
        } catch (e: any) {
          onToolStatus('');
          return `Lỗi: ${e.message}`;
        }
      },
    }),
    listDirectory: tool({
      description: 'Liệt kê các file và thư mục con trong một thư mục.',
      parameters: z.object({ path: z.string().describe('Đường dẫn thư mục cần liệt kê') }),
      execute: async ({ path }) => {
        onToolStatus(`⚙️ Đang liệt kê thư mục: ${path}`);
        try {
          const entries = readdirSync(path);
          const results = entries.map(entry => {
             const fullPath = `${path}/${entry}`;
             try {
                const isDir = statSync(fullPath).isDirectory();
                return isDir ? `${entry}/` : entry;
             } catch(e) { return entry; }
          });
          onToolStatus('');
          return results.join('\n');
        } catch (e: any) {
          onToolStatus('');
          return `Lỗi: ${e.message}`;
        }
      }
    }),
    createDirectory: tool({
      description: 'Tạo một thư mục mới.',
      parameters: z.object({ path: z.string().describe('Đường dẫn thư mục cần tạo') }),
      execute: async ({ path }) => {
        onToolStatus(`⚙️ Đang tạo thư mục: ${path}`);
        try {
          mkdirSync(path, { recursive: true });
          onToolStatus('');
          return `Đã tạo thư mục: ${path}`;
        } catch (e: any) {
          onToolStatus('');
          return `Lỗi: ${e.message}`;
        }
      }
    }),
    deleteFile: tool({
      description: 'Xóa một file hoặc thư mục (xóa đệ quy).',
      parameters: z.object({ path: z.string().describe('Đường dẫn file hoặc thư mục cần xóa') }),
      execute: async ({ path }) => {
         onToolStatus(`⚙️ Đang yêu cầu xóa: ${path}`);
         if (!(await requestApproval(`Xóa file/thư mục: ${path}`, 'Bạn có chắc chắn muốn xóa?'))) {
           onToolStatus('');
           return 'Người dùng đã TỪ CHỐI xóa.';
         }
         onToolStatus(`⚙️ Đang xóa: ${path}`);
         try {
           rmSync(path, { recursive: true, force: true });
           onToolStatus('');
           return `Đã xóa: ${path}`;
         } catch (e: any) {
           onToolStatus('');
           return `Lỗi: ${e.message}`;
         }
      }
    }),
    getFileMetadata: tool({
      description: 'Lấy thông tin metadata của một file (kích thước, thời gian).',
      parameters: z.object({ path: z.string().describe('Đường dẫn file') }),
      execute: async ({ path }) => {
        onToolStatus(`⚙️ Đang xem thông tin: ${path}`);
        try {
          const stat = statSync(path);
          onToolStatus('');
          return `Kích thước: ${stat.size} bytes\nTạo lúc: ${stat.birthtime}\nSửa lúc: ${stat.mtime}\nLà thư mục: ${stat.isDirectory()}`;
        } catch (e: any) {
          onToolStatus('');
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
        onToolStatus(`⚙️ Đang tìm kiếm: "${keyword}"`);
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
          onToolStatus('');
          if (results.length === 0) return `Không tìm thấy "${keyword}" trong project.`;
          const limited = results.slice(0, 50);
          return limited.join('\n') + (results.length > 50 ? `\n\n... (đã ẩn ${results.length - 50} kết quả)` : '');
        } catch (e: any) {
          onToolStatus('');
          return `Lỗi quét file: ${e.message}`;
        }
      },
    }),
  };
}

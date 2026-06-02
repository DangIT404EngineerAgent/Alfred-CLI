import { promises as fsPromises } from 'fs';
import { z } from 'zod';
import { tool } from 'ai';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync, copyFileSync, cpSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, basename } from 'path';
import * as os from 'os';
import * as pty from 'node-pty';
import { scanFiles } from '../utils/fs';

function validateProjectSyntax(): string | null {
  try {
    const res = spawnSync('npm', ['run', 'typecheck'], { cwd: process.cwd(), encoding: 'utf8', shell: true });
    if (res.status !== 0) {
       const out = res.stdout || res.stderr || '';
       return out.length > 800 ? out.slice(0, 800) + '\n... (đã rút gọn)' : out;
    }
  } catch (e: any) {
    // Nếu không chạy được lệnh, bỏ qua
  }
  return null;
}

const BACKUP_DIR = join(os.homedir(), '.terminalai', 'backups');
const BACKUP_MAP_PATH = join(BACKUP_DIR, 'latest_backup.json');

function backupPathObj(targetPath: string) {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    if (existsSync(targetPath)) {
      const backupPath = join(BACKUP_DIR, `${Date.now()}_${basename(targetPath)}`);
      cpSync(targetPath, backupPath, { recursive: true });
      let map: any = { stack: [] };
      try { if (existsSync(BACKUP_MAP_PATH)) map = JSON.parse(readFileSync(BACKUP_MAP_PATH, 'utf8')); } catch(e) {}
      map.stack.push({ original: targetPath, backup: backupPath, timestamp: Date.now() });
      writeFileSync(BACKUP_MAP_PATH, JSON.stringify(map), 'utf8');
    }
  } catch(e) { console.error('Lỗi khi backup:', e); }
}

export function restoreLatestBackup(): string {
  try {
    if (!existsSync(BACKUP_MAP_PATH)) return 'Không có bản sao lưu nào.';
    let map = JSON.parse(readFileSync(BACKUP_MAP_PATH, 'utf8'));
    if (!map.stack || map.stack.length === 0) return 'Không có bản sao lưu nào.';
    
    const last = map.stack.pop();
    if (existsSync(last.backup)) {
      cpSync(last.backup, last.original, { recursive: true });
      writeFileSync(BACKUP_MAP_PATH, JSON.stringify(map), 'utf8');
      return `✅ Đã khôi phục: ${last.original}`;
    } else {
      return '❌ File sao lưu không tồn tại trên ổ cứng.';
    }
  } catch(e: any) {
    return `❌ Lỗi khi khôi phục: ${e.message}`;
  }
}

export type ApprovalRequest = (title: string, detail: string, data?: any) => Promise<boolean>;

export function createTools(
  requestApproval: ApprovalRequest,
  onToolStatus: (msg: string) => void
) {
  return {
    runShell: tool({
      description: 'Chạy một câu lệnh terminal (bash/cmd/powershell). Hỗ trợ interactive thông qua node-pty.',
      parameters: z.object({ command: z.string().describe('Câu lệnh cần chạy') }),
      execute: async ({ command }) => {
        onToolStatus(`⚙️ Đang chạy lệnh: ${command}`);
        // Command Sanitization Blocklist
        if (/(rm\s+-rf\s+(\/|\*|~\/?$))|(mkfs\.)|(dd\s+if=)/i.test(command.trim())) {
           return 'CẢNH BÁO BẢO MẬT: Lệnh này bị cấm vì có nguy cơ phá hoại hệ thống. Hãy sử dụng giải pháp an toàn hơn!';
        }
        if (/(cat|type|less|more|tail|head)\s+.*?\.env/i.test(command.trim())) {
           return 'CẢNH BÁO BẢO MẬT: Không được phép đọc trực tiếp file .env để bảo vệ secret keys.';
        }
        if (!(await requestApproval('Chạy lệnh shell', command))) {
          onToolStatus('');
          return 'Người dùng đã TỪ CHỐI chạy lệnh này.';
        }
        try {
          return await new Promise((resolve) => {
            const isWin = os.platform() === 'win32';
            const shell = isWin ? process.env.COMSPEC || 'cmd.exe' : process.env.SHELL || 'bash';
            const args = isWin ? ['/c', command] : ['-c', command];
            
            const ptyProcess = pty.spawn(shell, args, {
              name: 'xterm-color',
              cols: process.stdout.columns || 80,
              rows: process.stdout.rows || 30,
              cwd: process.cwd(),
              env: process.env as any
            });

            let output = '';
            
            // Lắng nghe stdin từ ứng dụng nếu có
            const onData = (data: Buffer) => {
               ptyProcess.write(data.toString());
            };
            if (process.stdin.isTTY) {
               process.stdin.on('data', onData);
            }

            ptyProcess.onData((data: string) => {
              output += data;
              if (data.trim()) onToolStatus(`[shell] ${data.trim().slice(-100)}`);
            });

            ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
              if (process.stdin.isTTY) {
                 process.stdin.off('data', onData);
              }
              onToolStatus('');
              resolve(output || '(không có output)');
            });
          });
        } catch (e: any) {
          onToolStatus('');
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
        if (!(await requestApproval(`Ghi file: ${path}`, preview, { type: 'writeFile', content }))) {
          onToolStatus('');
          return 'Người dùng đã TỪ CHỐI ghi file này.';
        }
        onToolStatus(`⚙️ Đang ghi file: ${path}`);
        try {
          // Backup file trước khi ghi đè
          backupPathObj(path);
          
          // Lưu lại nội dung cũ để rollback nếu validation lỗi
          let oldContent: string | null = null;
          try { oldContent = readFileSync(path, 'utf8'); } catch(e) {}
          
          await fsPromises.writeFile(path, content, 'utf8');
          
          const syntaxErr = validateProjectSyntax();
          if (syntaxErr) {
             // Rollback
             if (oldContent !== null) await fsPromises.writeFile(path, oldContent, 'utf8');
             else rmSync(path, { force: true });
             onToolStatus('');
             return `Lỗi cú pháp sau khi ghi file! Đã tự động khôi phục lại (rollback).\nChi tiết lỗi:\n${syntaxErr}\nHãy sửa lại code và thử lại.`;
          }
          
          onToolStatus('');
          return `Đã ghi xong file: ${path}`;
        } catch (e: any) {
          onToolStatus('');
          return `Lỗi: ${e.message}`;
        }
      },
    }),
    replaceInFile: tool({
      description: 'Thay thế một khối code cũ bằng khối code mới trong file (Search & Replace Block). Hữu ích để sửa code an toàn.',
      parameters: z.object({
        path: z.string().describe('Đường dẫn file cần sửa'),
        searchBlock: z.string().describe('Đoạn code cũ chính xác cần tìm'),
        replaceBlock: z.string().describe('Đoạn code mới sẽ chèn vào thay thế'),
      }),
      execute: async ({ path, searchBlock, replaceBlock }) => {
        onToolStatus(`⚙️ Đang yêu cầu sửa file: ${path}`);
        const preview = `Thay thế block:\n${searchBlock}\nThành:\n${replaceBlock}`;
        if (!(await requestApproval(`Sửa file: ${path}`, preview.slice(0, 500) + (preview.length > 500 ? '...' : ''), { type: 'diff', searchBlock, replaceBlock }))) {
          onToolStatus('');
          return 'Người dùng đã TỪ CHỐI sửa file này.';
        }
        onToolStatus(`⚙️ Đang sửa file: ${path}`);
        try {
          // Backup file trước khi sửa
          backupPathObj(path);
          
          const content = readFileSync(path, 'utf8');
          if (!content.includes(searchBlock)) {
            onToolStatus('');
            return `Lỗi: Không tìm thấy khối mã cũ trong file. Vui lòng đảm bảo searchBlock khớp chính xác từng ký tự và khoảng trắng.`;
          }
          const newContent = content.replace(searchBlock, replaceBlock);
          
          // Ghi file tạm để test
          await fsPromises.writeFile(path, newContent, 'utf8');
          
          const syntaxErr = validateProjectSyntax();
          if (syntaxErr) {
             // Rollback
             await fsPromises.writeFile(path, content, 'utf8');
             onToolStatus('');
             return `Lỗi cú pháp sau khi sửa! Đã tự động khôi phục lại (rollback).\nChi tiết lỗi:\n${syntaxErr}\nHãy sửa lại code và thử lại.`;
          }
          
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
           backupPathObj(path);
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

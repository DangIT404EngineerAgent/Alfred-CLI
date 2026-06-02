import { promises as fs } from 'fs';
import { relative, join, sep } from 'path';
import ignore from 'ignore';

const DEFAULT_IGNORE = ['.git', 'node_modules', 'dist', 'build', 'coverage'];

export async function scanFiles(root: string, max = 2000): Promise<string[]> {
  const ig = ignore().add(DEFAULT_IGNORE);

  try {
    const gitignoreContent = await fs.readFile(join(root, '.gitignore'), 'utf8');
    ig.add(gitignoreContent);
  } catch (e) {
    // If no .gitignore exists, just continue
  }

  const out: string[] = [];

  const walk = async (dir: string) => {
    if (out.length >= max) return;
    
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of entries) {
      if (out.length >= max) return;
      
      const full = join(dir, e.name);
      const relPath = relative(root, full).split(sep).join('/');

      // Skip ignored paths or hidden directories
      if (ig.ignores(relPath)) continue;
      
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue; // ignore hidden dirs by default
        await walk(full);
      } else if (e.isFile()) {
        out.push(relPath);
      }
    }
  };

  await walk(root);
  return out;
}

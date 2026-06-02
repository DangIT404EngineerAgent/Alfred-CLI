import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { readFile } from 'fs/promises';

// Create a small file for testing
const testFile = 'test-file.txt';
writeFileSync(testFile, 'A'.repeat(50 * 1024)); // 50KB file

async function runBenchmark() {
  const iterations = 10000;

  console.log('--- Benchmarking Sync ---');
  let syncStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    readFileSync(testFile, 'utf8');
  }
  let syncEnd = Date.now();
  console.log(`Sync readFileSync took: ${syncEnd - syncStart}ms`);

  console.log('--- Benchmarking Async ---');
  let asyncStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await readFile(testFile, 'utf8');
  }
  let asyncEnd = Date.now();
  console.log(`Async readFile took: ${asyncEnd - asyncStart}ms`);
}

runBenchmark().catch(console.error).finally(() => {
  unlinkSync(testFile);
});

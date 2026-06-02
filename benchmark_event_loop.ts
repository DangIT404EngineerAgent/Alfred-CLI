import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { readFile } from 'fs/promises';

const testFile = 'test-file.txt';
writeFileSync(testFile, 'A'.repeat(50 * 1024 * 1024)); // 50MB file to make read slow enough to measure blocking

function measureEventLoopLag(ms: number) {
  return new Promise<number>((resolve) => {
    const start = Date.now();
    setTimeout(() => {
      resolve(Date.now() - start - ms);
    }, ms);
  });
}

async function runBenchmark() {
  console.log('--- Benchmarking Sync (Event Loop Blocking) ---');
  let lagPromise = measureEventLoopLag(10);
  let start = Date.now();
  for (let i = 0; i < 100; i++) {
    readFileSync(testFile, 'utf8');
  }
  let end = Date.now();
  let lag = await lagPromise;
  console.log(`Time taken: ${end - start}ms`);
  console.log(`Event loop lag: ${lag}ms`);

  console.log('--- Benchmarking Async (Event Loop Blocking) ---');
  lagPromise = measureEventLoopLag(10);
  start = Date.now();
  for (let i = 0; i < 100; i++) {
    await readFile(testFile, 'utf8');
  }
  end = Date.now();
  lag = await lagPromise;
  console.log(`Time taken: ${end - start}ms`);
  console.log(`Event loop lag: ${lag}ms`);
}

runBenchmark().catch(console.error).finally(() => {
  unlinkSync(testFile);
});

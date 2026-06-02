import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  outDir: 'dist',
  minify: true,
});


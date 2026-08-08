import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite build config for standalone prompt-manager script.
 */
export default defineConfig(({ mode }) => ({
  publicDir: false,
  build: {
    outDir: 'standalone-scripts/prompt-manager/dist',
    emptyOutDir: false,
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode !== 'development' ? 'esbuild' : false,
    lib: {
      entry: resolve(__dirname, 'standalone-scripts/prompt-manager/src/index.ts'),
      name: 'PromptManager',
      formats: ['iife'],
      fileName: () => 'prompt-manager.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@prompt-manager': resolve(__dirname, 'standalone-scripts/prompt-manager/src'),
    },
  },
}));

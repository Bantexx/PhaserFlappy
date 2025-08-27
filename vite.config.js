import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/PhaserFlappy/',
  server: {
    host: true
  }
}));
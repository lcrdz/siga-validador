import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // content.js only activates on this SIGA page
        url: 'https://siga.congregacao.org.br/TES/TES00801.aspx',
        pretendToBeVisual: true,
      },
    },
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'html'],
    },
  },
});

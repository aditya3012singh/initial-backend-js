import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/helpers/prisma.mock.js'],
    include: ['src/**/*.test.js', 'scripts/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'prisma/',
        'scripts/',
        'src/__tests__/helpers/',
        'vitest.config.js'
      ]
    }
  }
});

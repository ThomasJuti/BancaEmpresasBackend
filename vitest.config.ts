import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/**/domain/**/*.ts',
        'src/**/application/**/*.ts',
        'src/shared/**/*.ts',
        'src/core/**/domain/**/*.ts',
        'src/core/**/application/**/*.ts',
        'src/features/**/infrastructure/chunk.ts',
        'src/features/**/infrastructure/map-with-concurrency.ts',
        'src/features/**/infrastructure/email-template.ts',
        'src/features/**/infrastructure/token-service.ts',
        'src/features/**/infrastructure/InMemoryCallRepository.ts',
        'src/features/**/infrastructure/demo-shipment-scheduler.ts',
      ],
      exclude: [
        'src/dev-server.ts',
        'src/**/*.test.ts',
        'src/shared/contracts/**',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 92,
        branches: 80,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

// Isolated config for unit/regression tests. Deliberately does NOT load the
// layout dev-server plugin or app env — tests target pure logic in src/lib.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});

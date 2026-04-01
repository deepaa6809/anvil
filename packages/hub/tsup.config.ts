import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts', 'src/db.ts', 'src/validation.ts', 'src/auth.ts', 'src/middleware.ts', 'src/handlers.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
});

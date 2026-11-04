/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: { sourcemap: true, chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 20000,
  },
})

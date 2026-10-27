// Vitest 配置：serialize/parse 为纯逻辑（无 DOM 依赖），用 node 环境即可
import { defineConfig } from 'vitest/config'
import { sourceAliases } from './config/aliases'

export default defineConfig({
  resolve: { alias: sourceAliases },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.mjs'],
  },
})

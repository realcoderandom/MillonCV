import { fileURLToPath } from 'node:url'

// Vite 与 Vitest 共用解析；TypeScript 的 @/* 对应关系在 tsconfig.json 中维护。
export const sourceAliases = [
  { find: '@', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
  // Paged.js 没有导出 UMD 子路径，集中声明资源入口，业务源码不跨目录访问 node_modules。
  { find: /^@pagedjs-script(?=\?|$)/, replacement: fileURLToPath(new URL('../node_modules/pagedjs/dist/paged.min.js', import.meta.url)) },
]

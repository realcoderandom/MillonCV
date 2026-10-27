import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sourceAliases } from './config/aliases'

export default defineConfig({
  // 相对路径：可移植部署到任意子路径或根域名（GitHub Pages 子路径 / Vercel / Netlify 均可）
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: sourceAliases },
  // 该别名导出 UMD 脚本的 URL；Vite 的别名预构建会忽略查询语义，需按完整导入名排除。
  optimizeDeps: { exclude: ['@pagedjs-script?url'] },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('tiptap-markdown')) return 'editor'
          if (id.includes('marked') || id.includes('dompurify')) return 'markdown'
          if (id.includes('node_modules/react') || id.includes('node_modules/zustand')) return 'vendor'
        },
      },
    },
  },
})

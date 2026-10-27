// ESLint flat config：strict + react-hooks
// typescript-eslint recommended 守护类型安全；marked token 解析处的 any 已用 eslint-disable 标注
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { packageBoundaries } from './scripts/eslint/package-boundaries.mjs'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'legacy/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      architecture: { rules: { 'package-boundaries': packageBoundaries } },
    },
    rules: {
      'architecture/package-boundaries': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 允许未使用参数前缀 _ 占位（如 catch (_e)）；ignoreRestSiblings 允许解构剥离废弃字段
      // （如 store 迁移里 const { summary, fieldOrder, ...rest } = it 剥离 fieldOrder）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
)

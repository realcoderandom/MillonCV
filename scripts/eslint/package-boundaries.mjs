import path from 'node:path'

// 依赖方向按运行职责排列；模型仅以类型引用注册表派生的 TemplateId。
const dependencies = {
  shared: [],
  resume: ['shared'],
  templates: ['resume', 'shared'],
  state: ['resume', 'templates', 'shared'],
  editor: ['resume', 'templates', 'state', 'shared'],
  preview: ['resume', 'templates', 'state', 'shared'],
  workspace: ['resume', 'templates', 'state', 'editor', 'preview', 'shared'],
  app: ['resume', 'templates', 'state', 'editor', 'preview', 'workspace', 'shared'],
}
const viewPackages = ['react', 'react-dom', 'zustand', '@tiptap', 'tiptap-markdown', 'pagedjs', 'lucide-react']

export const packageBoundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      dependency: '{{from}} 不应依赖 {{to}}；请将共用契约移至下层包，或在 app/workspace 组合。',
      alias: '跨包引用使用 @/ 路径，包内引用使用相对路径。',
      external: 'resume 核心不应依赖界面或状态框架 {{name}}。',
      outside: '源码不能通过相对路径访问 src 之外的模块；使用依赖包名或配置中的资源别名。',
      unregistered: '新包 {{name}} 需在 package-boundaries.mjs 中声明依赖方向。',
    },
  },
  create(context) {
    const root = path.join(context.cwd, 'src')
    const filename = path.relative(root, context.filename).split(path.sep).join('/')
    if (filename.startsWith('../') || filename.includes('/__tests__/') || /\.test\.[cm]?[jt]sx?$/.test(filename)) return {}
    const from = filename.split('/')[0]
    if (!(from in dependencies)) return filename.includes('/')
      ? { Program: (node) => context.report({ node, messageId: 'unregistered', data: { name: from } }) }
      : {}

    const check = (source, typeOnly = false) => {
      const name = source?.value
      if (typeof name !== 'string') return
      let target
      if (name.startsWith('@/')) target = path.posix.normalize(name.slice(2))
      else if (name.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(filename), name))
      else {
        if (from === 'resume' && viewPackages.some((pkg) => name === pkg || name.startsWith(pkg + '/'))) context.report({ node: source, messageId: 'external', data: { name } })
        return
      }
      if (target.startsWith('../')) {
        context.report({ node: source, messageId: 'outside' })
        return
      }
      const to = target.split('/')[0]
      const modelId = filename === 'resume/model.ts' && /^templates\/registry(?:\.ts)?$/.test(target) && typeOnly
      if (from !== to && !dependencies[from].includes(to) && !modelId) {
        context.report({ node: source, messageId: 'dependency', data: { from, to } })
      } else if (from !== to && !name.startsWith('@/')) {
        context.report({ node: source, messageId: 'alias' })
      }
    }
    const declaration = (node) => check(node.source, node.importKind === 'type' || node.exportKind === 'type'
      || Boolean(node.specifiers?.length && node.specifiers.every((specifier) => specifier.importKind === 'type' || specifier.exportKind === 'type')))
    return {
      ImportDeclaration: declaration,
      ExportNamedDeclaration: declaration,
      ExportAllDeclaration: declaration,
      ImportExpression: (node) => check(node.source),
      TSImportType: (node) => check(node.source ?? node.argument, true),
    }
  },
}

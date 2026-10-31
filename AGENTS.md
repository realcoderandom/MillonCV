# Coding Agent 入口

React + TypeScript 简历工具，模块、富文本和 Markdown 源码共享结构化数据；预览用 Paged.js 分页，PDF 通过浏览器打印保存。

只用 **npm**。先看工作区差异，保留已有未提交改动。

```bash
npm run dev      # 默认 http://localhost:5173
npm test
npm run test:e2e # 构建产物上的 Chromium 桌面 / 手机回归；首次需安装浏览器
npm run lint
npm run build    # 含类型检查
```

## 关键约束

- `Resume.sections` 是正文唯一数据源；保留 Markdown 标题标记的类型与 id、`custom` 兜底和往返一致性。
- Store 使用不可变更新；正文、主题、布局和历史的引用同时驱动渲染与持久化缓存。
- 切模式、切简历、恢复快照及导入导出前先 `flushSync(flushActiveEditorDraft)`；离开页面时先提交草稿再 flush 存储。
- 存储读取成功后才允许空状态初始化；读取失败保留原始数据并禁止写入，不能当作首次使用。
- 模板只在注册表登记，由 `Body` 决定布局；CSS 用 `.resume.{id}` 隔离，保留已有模板、主题和数据的兼容性。
- 保留 `resume-maker:store` 存储键，变更通过兼容迁移处理。

## 按任务阅读

| 任务 | 文档 |
|---|---|
| 安装、使用、排障 | [README](README.md) |
| 架构、编辑同步、保存 | [开发文档](docs/DEVELOPMENT.md#architecture)、[编辑协议](docs/DEVELOPMENT.md#editing) |
| 分包职责、路径与依赖方向 | [包结构](docs/DEVELOPMENT.md#packages) |
| 模板、主题、新分节 | [模板协议](docs/DEVELOPMENT.md#templates)、[扩展方法](docs/DEVELOPMENT.md#extension) |
| 预览、分页、PDF | [分页链路](docs/DEVELOPMENT.md#pdf) |
| 检查与结果记录 | [验证指南](docs/VALIDATION.md) |
| 编码、文档维护、任务记录 | [贡献指南](CONTRIBUTING.md#documentation) |

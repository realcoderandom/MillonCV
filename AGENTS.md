# Coding Agent 指南

MillonCV 是一个基于 React 和 TypeScript 的简历编辑与排版工具。模块表单、富文本和 Markdown 源码三种编辑方式共享同一份结构化数据；实时预览由 Paged.js 负责 A4 分页，PDF 通过浏览器打印导出。

开始修改前请先查看工作区差异，并保留已有的未提交改动。项目统一使用 **npm** 管理依赖与脚本：

```bash
npm run dev      # 启动本地开发服务（默认 http://localhost:5173）
npm test         # 运行单元测试与架构边界检查
npm run test:e2e # 在生产构建产物上运行 Chromium 桌面与移动端回归（首次需先安装浏览器）
npm run lint     # 代码风格与包边界静态检查
npm run build    # 执行类型检查并构建生产产物
```

## 核心约束

- **单一数据源与往返一致性**：`Resume.sections` 是正文唯一数据源。调整解析或序列化逻辑时，需保留 Markdown 标题标记中的模块类型与 id、`custom` 兜底机制，以及双向往返一致性。
- **不可变状态更新**：Store 必须保持不可变更新；正文、主题、布局和历史记录的对象引用同时用于驱动渲染与持久化序列化缓存。
- **草稿同步与退出落盘**：切换编辑模式、切换简历、恢复快照或导入导出前，必须先调用 `flushSync(flushActiveEditorDraft)` 提交草稿；离开页面时应先提交草稿，再 flush 存储队列。
- **存储读取与容错保护**：只有在本地存储读取成功后，才允许初始化空状态。读取失败时必须保留原始数据并禁止写入，切勿将其视为首次使用。
- **模板隔离与向后兼容**：模板统一在注册表中登记，由各自的 `Body` 组件决定布局，样式使用 `.resume.{id}` 作用域隔离；迭代时需保障已有模板、主题及历史数据的兼容性。
- **持久化键与版本迁移**：保持 `resume-maker:store` 存储键不变，数据结构变更一律通过兼容迁移处理。

## 文档导航

| 场景 / 任务 | 参考文档 |
|---|---|
| 安装、日常使用与常见问题排查 | [README](README.md) |
| 整体架构、编辑同步与持久化机制 | [开发文档](docs/DEVELOPMENT.md#architecture)、[编辑协议](docs/DEVELOPMENT.md#editing) |
| 目录分包、路径规范与依赖方向 | [包结构](docs/DEVELOPMENT.md#packages) |
| 模板机制、主题配色与新增分节 | [模板协议](docs/DEVELOPMENT.md#templates)、[扩展方法](docs/DEVELOPMENT.md#extension) |
| 实时预览、分页链路与 PDF 导出 | [分页链路](docs/DEVELOPMENT.md#pdf) |
| 检查流程与验证结果记录 | [验证指南](docs/VALIDATION.md) |
| 编码规范、文档维护与任务记录 | [贡献指南](CONTRIBUTING.md#documentation) |

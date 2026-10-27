# 架构与工程约定

本文维护当前实现的协议和兼容边界。用户操作见 [README](../README.md)，维护规则见[贡献指南](../CONTRIBUTING.md#documentation)，检查方法见[验证指南](VALIDATION.md)。

<a id="architecture"></a>

## 项目关系

Vite + React 18 + TypeScript，Zustand 管理状态，Tiptap 提供富文本，marked 与 DOMPurify 解析和安全渲染 Markdown，Paged.js 生成分页页面。

```text
模块表单 ───────────▶ Resume.sections ◀──parse── 富文本 / 源码
                           │  └──serialize──▶ Markdown 备份 / 编辑器
                           ├──▶ Zustand ──▶ localStorage
                           └──▶ 模板 Body ──▶ Paged.js 分页 DOM
                                               ├──▶ iframe 预览
                                               └──▶ 打印快照 ──▶ window.print()
```

数据模型只通过 `import type` 使用注册表派生的模板 id，不在运行时加载模板组件或 CSS。模板契约、存储读取边界和模块编辑命令各自独立，具体入口见下文。

<a id="packages"></a>

## 分包与依赖方向

按职责分包，组件、逻辑、样式和测试放在各自所属模块中：

```text
src/
  app/          应用组装与全局基础样式
  resume/       数据模型、编辑命令、布局、照片与 Markdown 协议
  state/        Zustand、版本迁移、存储适配与草稿提交协议
  templates/    插件契约、注册表、有效主题、渲染原子与模板样式
  editor/       modules、rich、source、fields、photo 与编辑器样式
  preview/      预览、分页、字体、PDF 与打印样式
  workspace/    工具栏、版本切换、设置、恢复提示与工作区布局
  shared/       通用 UI、Hooks、尺寸计算和 id 工具
```

| 包 | 可依赖的项目内包 |
|---|---|
| `shared` | 无业务包依赖 |
| `resume` | `shared` |
| `templates` | `resume`、`shared` |
| `state` | `resume`、`templates`、`shared` |
| `editor`、`preview` | `resume`、`templates`、`state`、`shared` |
| `workspace` | 上述包，负责工作区控件组合 |
| `app` | 上述包，负责编辑器与预览的整页组合 |

`resume/model.ts` 仅以类型引用 `templates/registry.ts` 的派生 `TemplateId`，这是模型唯一的模板依赖；运行时仍保持上述方向。`resume` 不依赖 React、Zustand 或编辑器框架。编辑器与预览通过 `resume/focus.ts` 的定位契约协作，不能彼此导入组件；模板渲染原子由 `templates/rendering.tsx` 持有，模板不反向依赖预览编排。

跨包引用使用 `@/包名/具体模块`，包内使用相对路径，不添加汇总所有实现的 barrel 入口。TypeScript 路径映射在 [tsconfig.json](../tsconfig.json)，Vite 与 Vitest 共用 [aliases.ts](../config/aliases.ts)；Paged.js UMD 资源的特殊入口也集中在这里。`main.tsx` 按固定顺序组合各包样式，编辑器懒加载入口在 `app/App.tsx`。

`@pagedjs-script?url` 为 iframe 提供经典脚本的静态资源 URL。[vite.config.ts](../vite.config.ts) 按完整导入名设置 `optimizeDeps.exclude`，避免 Vite 开发模式的别名预解析把它误送入依赖预构建；仅验证生产构建或单次模块转换不能覆盖此路径，须运行开发模式浏览器回归。

[包边界规则](../scripts/eslint/package-boundaries.mjs) 随 `pnpm lint` 检查静态导入、动态导入、重导出和类型导入；规则回归位于 [tests/architecture](../tests/architecture)。新增跨包协作优先传递契约或在上层组合，调整依赖方向时同步维护规则与本节。单元测试与被测包就近存放，浏览器流程统一放在 `tests/e2e`。

<a id="data-model"></a>

## 数据模型

入口：[resume/model.ts](../src/resume/model.ts)。

- `Resume.sections` 是正文唯一数据源，支持基本信息、工作经历、教育、项目、技能和自定义模块。技能、简介和描述使用 Markdown；`custom` 承接无法识别的内容。
- `Resume.name` 是版本名称，与基本信息中的候选人姓名独立；`workExperience` 是用户填写的短文本，不从经历推算。
- 经历使用 `DatedItem`，`rightText` 承载日期、地点或 GPA 等右侧内容，`description` 保存正文，`projects` 仅支持一级子项目。
- `theme` 保存文档排版，独立模板覆盖值存在 `templateThemeOverrides`；`layout` 保存显示顺序、主栏 / 侧栏和栏宽，不改写 sections 的正文顺序。
- 应用内 `Resume.template` 使用注册表派生的字面量联合类型。外部输入 `ResumeInput` 允许字符串模板标识，存储边界的 `StoredResume` 还允许旧版缺省主题，读取规范化后才成为 `Resume`。

<a id="state"></a>

## 保存与兼容

入口：[useResumeStore.ts](../src/state/useResumeStore.ts)、[状态契约](../src/state/types.ts)、[版本迁移](../src/state/resumeMigrations.ts)、[读取规范化](../src/state/resumeNormalization.ts)、[debouncedStorage.ts](../src/state/storage/debouncedStorage.ts)。

- Zustand 持久化键固定为 `resume-maker:store`。迁移同时遍历正文、快照、删除记录及解析撤销的 `previousSections`，读取规范化共用于主文档、历史、删除记录与导入。不得因品牌或界面调整重置数据；字段缺省保留旧行为。
- `resumeMigrations.ts` 的版本常量与迁移列表维护一次性字段转换，公共遍历负责所有历史容器；新增版本不要只修改主文档。`resumeNormalization.ts` 负责每次读取的模板、主题与布局规范化，以及持久字段的白名单合并，不覆盖 Store 操作函数。
- 保留旧 `start/end` → `rightText`、项目 `techStack/summary` → `description` 的迁移。旧默认标题「项目经历」一次性改为「项目经验」，自定义标题不变。
- 普通修改的快照按 30 秒间隔限频，每份简历最多 10 份；恢复前先保存当前内容。界面提供 8 秒删除撤销，局部恢复不覆盖期间其他字段的修改。
- 存储与编辑解析独立防抖：存储队列保留最新原始状态，500ms 停顿后才编码并写入；页面离开仍同步 flush。编码或写入失败保留待写状态，显示失败并支持重试；快照仍在同一浏览器存储中，不能代替外部备份。
- Store 必须不可变更新；[stateSerialization.ts](../src/state/storage/stateSerialization.ts) 按顶层字段引用缓存最近一次 JSON。偏好更新复用未变的正文 / 历史片段，保存格式仍为同一键的 `{ state, version }`。新增 Store 持久化字段时，同时维护状态契约、`partialize`、读取校验与合并白名单。
- 读取时先校验存储封装、正文和历史结构，再迁移合并；未来版本、JSON 解析或格式异常进入恢复界面。失败会清除排队写入并锁定存储，原始 JSON 可下载，重试读取成功后才解除保护。入口为 [resumeStorageSchema.ts](../src/state/storage/resumeStorageSchema.ts) 与 [resumeHydration.ts](../src/state/storage/resumeHydration.ts)。
- 首次空状态在读取成功后由 App 注入示例，防止 StrictMode 重复初始化；读取失败不创建示例。编辑模式属于工作区状态，编辑器实例按简历 id 隔离。

<a id="editing"></a>

## 编辑与 Markdown 协议

入口：[ModularEditor](../src/editor/modules/ModularEditor.tsx)、[RichEditor](../src/editor/rich/RichEditor.tsx)、[SourceEditor](../src/editor/source/SourceEditor.tsx)；协议集中在 [resume/markdown](../src/resume/markdown)。

- 模块字段通过 `MarkdownField` 等组件直接更新 sections；富文本 / 源码保存即时草稿，防抖 400ms 解析回写。`dirtyRef` 与 `skipSyncRef` 避免外部覆盖和循环同步。
- 模块表单的字段更新、增删与局部撤销集中在 [commands.ts](../src/resume/commands.ts)。命令绑定简历 id，通过状态 getter 每次读取最新内容，不依赖 React、DOM 或具体 Store 实现；无目标的操作保留原引用。撤销仅恢复删除部分，不回滚之后的其他编辑与布局调整。
- `ModularEditor` 负责目录、折叠、焦点和布局交互；[BasicsEditor](../src/editor/modules/BasicsEditor.tsx) 与 [ItemsEditor](../src/editor/modules/ItemsEditor.tsx) 组合表单，字段键盘行为和操作菜单分别在 `ModuleField`、`ModuleContentActions` 复用。删除提示的 `ContentUndo` 契约来自命令层。
- 切模式、切换 / 新建 / 复制 / 删除简历、恢复快照、导入及导出前先 `flushSync(flushActiveEditorDraft)`。恢复快照确认后先提交并同步草稿，再保存恢复前版本、应用历史内容，旧防抖不能覆盖恢复结果。页面隐藏或离开时按“草稿提交 → store 更新 → 存储 flush”执行，卸载提交只作兜底。协议入口是 [editorDraft.ts](../src/state/editing/editorDraft.ts)。
- `serialize` / `parse` 必须保持往返一致。标题前的 `<!-- resume:{...} -->` 保存模块类型与各级 id，必须保留自定义标题、空模块和同名条目的身份；重复 id 重新分配，无标记 Markdown 继续启发式解析和诊断。
- `metadata.ts` 与 `ResumeStarterKit` 维护富文本标记，`sourceDocument.ts` 分离源码正文与隐藏标记；只隐藏有效顶层协议行，不能改写代码块示例和普通注释。源码高亮不参与解析或修改原字符。
- 条目头为 `### 名称 — 角色 || 时间`；一级子项目为 `#### 子项目：名称 — 角色 || 时间`，普通旧 H4 不自动升级为子项目。`工作经验：…` 是基本信息的独立可选段落。
- 名称或角色含 `—`、`|`、反引号或 Markdown 特殊字符时，使用原生行内代码引用保存字面值，例如 ``### `平台 — 国内业务` — `开发 || 运维` || 2024 - 至今``；解析仅在引用外拆分分隔符，富文本保留代码标记但沿用标题外观。编码与解析集中在 [itemHeading.ts](../src/resume/markdown/itemHeading.ts)，旧的普通条目格式继续支持。
- `render.ts` 经 DOMPurify 净化；正文与列表中的 `||` 支持左右对齐，联系信息通过 `plain.ts` 清洗行内格式。富文本只开放与解析协议匹配的 Markdown 语法。
- Markdown 备份携带正文、照片及结构标记，不携带模板、主题、预览布局或快照。导出应读取草稿提交后的最新 store；导入入口是 [io.ts](../src/resume/markdown/io.ts)。

<a id="templates"></a>

## 模板、主题与布局

入口：[registry.ts](../src/templates/registry.ts)、[theme.ts](../src/templates/theme.ts)、[resume/layout.ts](../src/resume/layout.ts)、[共享渲染](../src/templates/rendering.tsx)。

- 注册表是唯一模板清单；`TEMPLATES` 供选择器使用，`LEGACY_TEMPLATES` 保留旧版式。`TemplateId`、标签及查找由此派生，未知 id 完整回退经典的组件和 CSS 类。旧 `asu` 在读取边界转换为 `technicalCompact`，主题覆盖只转换已知别名，保留未知模板键。
- 插件契约在 [templates/types.ts](../src/templates/types.ts)，各插件从此处导入类型。声明使用 `id: '模板名' as const` 与 `satisfies TemplatePlugin`，避免将 id 扩宽成 `string`；新增模板无需手动维护第二份 id 联合类型。
- 插件的 `Body({ sections, layout })` 决定布局，预览主流程不添加模板分支。CSS 使用 `.resume.{id}` 全局类隔离，不改用 CSS Modules；模板可组合共享原子或自己的条目组件。
- `themeScope` 缺省为文档作用域，消费 `resume.theme`；独立作用域使用 `DEFAULT_THEME + defaultTheme + templateThemeOverrides[id]`。预览、缩略图、设置、字体和打印通过 `resolveResumeTheme` 取得相同有效主题。
- 跨作用域切模板不改写共享主题；独立模板字段的 `undefined` 删除该覆盖，重置清除当前模板覆盖。旧文档共享主题和其他模板配置保留。
- `layout.order`、`regions` 按 section id 保存，新增模块追加，失效引用不隐藏正文。单栏忽略但保留分栏配置；双栏默认元数据由插件 `sidebar` 提供，栏宽范围 24%–45%。目录排序与预览共用布局工具，条目和子项目排序直接更新数组。
- 根元素注入 `--accent`、`--fs`、`--pad`、`--lh` 等主题变量；字号与历史边距值使用 px。UI 的 `--ui-*` 与纸张主题分离，深浅界面切换不改变简历配色。
- [themeColors.ts](../src/resume/themeColors.ts) 提供 6 个常用色（深蓝、墨灰、雾蓝、灰绿、深青、暖棕）和 2 个更多色（莓红、松绿）。配色控件仅提交 `primaryColor`，保留字体、字号、间距、照片与布局；恢复模板配色同样只恢复颜色。完整风格预设保留在折叠的「整套风格」中，明确同时应用颜色与排版。
- [colors.ts](../src/templates/colors.ts) 从保存的原始主色派生文字、浅底、分隔线、色带与深底文字，不改写存储。普通主题文字在白纸 / 浅底、白字在色带，以及彩字在历史深色纸张 / 侧栏上的对比度目标均为 5:1；模板通过 `--accent-text/soft/line/band/on-band/on-dark` 按用途消费，正文保持中性色。自定义及历史 CSS 颜色也经过相同解析，旧数据不迁移或重置。
- 配色面板使用紧凑的具名色块，不渲染示例小样；悬停 / 聚焦不改写主题，点击颜色才应用，并在实际简历预览中查看效果。更多、自定义与恢复配色共用一行，完整风格按需展开。实际分页与打印使用同一组配色变量。

### 照片与定位

- [photo.ts](../src/resume/photo.ts) 校验并压缩本地位图，上传裁切为 336×432，体积约束以代码为准；不保存临时 blob URL 或外部图片地址。`BasicsData.photo` 以独立图片段落随 Markdown 备份。
- `photoWidth` 为主题字段，范围 56–140px，默认 84×108px，比例 7:9；照片占独立列，简介通栏，无照片不留空列，侧栏中按可用宽度缩小。
- [focus.ts](../src/resume/focus.ts) 用简历、模块、条目、子项目 id 和字段名定位；预览保留 `data-resume-*` 标识，分页后仍可定位后续片段。编辑仅更新高亮，显式定位才滚动；链接点击、文本选择和键盘操作保持可用。

<a id="pdf"></a>

<a id="one-page"></a>

## 分页、智能一页与 PDF

入口：[ResumePreview](../src/preview/ResumePreview.tsx)、[resumePagination.ts](../src/preview/pagination/resumePagination.ts)、[paginationReady.ts](../src/preview/pagination/paginationReady.ts)、[pdf.ts](../src/preview/pdf.ts)。

1. 用有效主题渲染隐藏的 A4 源 DOM，等待字体与图片后，在 iframe 内用本地打包的 Paged.js 分页；实际页数来自分页结果。
2. 智能一页结合源高度与实际页数做有限次临时压缩，下限为 0.85。放不进一页时恢复原主题与多页结果；压缩不写回 store，状态按 `resume.id:template` 隔离。
3. [paginationQueue.ts](../src/preview/pagination/paginationQueue.ts) 串行执行分页，同时最多保留一个运行中作业和一个最新待办。正文、有效主题和布局变化停顿 200ms 后再算；首次加载、切简历 / 模板立即调度，版本重命名与 UI 偏好不触发重排。过期结果不发布，卸载取消待办并等待运行中作业结束后清理分页器。
4. 布局提交时即登记最新任务并标记计算中；计算中与失败状态不能当作完成结果。发布时将同一批分页 DOM 和样式复制到 `#resume-print-root`，供打印使用。
5. 打开导出入口会立即推动待办，等待最新分页与图片解码；等待期间若有新任务则继续等最新结果，再临时设置标题并调用 `window.print()`。分页失败阻止导出，不能打印旧快照。用户在浏览器另存为 PDF，应用没有独立 PDF 文件生成器。

样式由 [main.tsx](../src/main.tsx) 引入；`print.css` 管理打印与内容防断页，`pagination.css` 切换打印根节点，`paged-document.css` 管理分页文档。字体由 [fonts.ts](../src/preview/fonts.ts) 按需加载，离线回退会影响排版。共用分页 DOM 仍需检查实际 PDF，标准见[验证指南](VALIDATION.md#browser)。

<a id="extension"></a>

## 常见扩展

- **新增模板**：创建 `src/templates/<id>/index.tsx` 和 CSS，按上述字面量与 `satisfies` 约定导出含 `id/label/bestFor/description/Body` 的插件，再登记注册表；按需声明 `sidebar` 或独立主题默认值，不改编辑与数据协议。
- **新增分节类型**：同步数据模型、`resume/sections.ts`、`resume/commands.ts`、`editor/modules/moduleConfig.ts` 与模块表单、Markdown 的 serialize / parse / metadata、共享及模板专属渲染分发，补往返与历史缺省用例。模块配置和条目标签使用完整的类型映射，渲染分发穷举 `Section`；扩展模型后先运行类型检查，补齐编译器指出的分支，避免默认强转成列表数据。
- **修改工作区**：目录宽度与响应式计算集中在 [workspaceLayout.ts](../src/shared/layout/workspaceLayout.ts)，导航交互在 [ModuleNavigation](../src/editor/modules/ModuleNavigation.tsx)。折叠保留字段实例与撤销，收窄不改写用户宽度偏好；UI 调整仍需检查焦点和输入保存。

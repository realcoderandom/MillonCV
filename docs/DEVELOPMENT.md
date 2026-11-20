# 架构与工程约定

本文档维护 MillonCV 当前实现的架构协议、数据流与兼容边界。日常使用方式见 [README](../README.md)，文档与协作规范见[贡献指南](../CONTRIBUTING.md#documentation)，测试与验收标准见[验证指南](VALIDATION.md)。

<a id="architecture"></a>

## 项目关系

项目基于 Vite、React 18 与 TypeScript 构建：Zustand 负责状态与持久化，Tiptap 提供富文本编辑，marked 与 DOMPurify 负责 Markdown 解析与安全渲染，Paged.js 负责 A4 分页排版。

```text
模块表单 ───────────▶ Resume.sections ◀──parse── 富文本 / 源码
                           │  └──serialize──▶ Markdown 备份 / 编辑器
                           ├──▶ Zustand ──▶ localStorage
                           └──▶ 模板 Body ──▶ Paged.js 分页 DOM
                                               ├──▶ iframe 预览
                                               └──▶ 打印快照 ──▶ window.print()
```

数据模型仅通过 `import type` 引用注册表派生的模板标识，不在运行时依赖模板组件或 CSS。模板契约、存储校验边界与模块编辑命令彼此解耦，具体入口见下文各节。

<a id="packages"></a>

## 分包与依赖方向

源码按职责分包，组件、业务逻辑、样式与单元测试均就近存放在所属包内：

```text
src/
  app/          应用组装与全局基础样式
  resume/       数据模型、编辑命令、布局、照片处理与 Markdown 协议
  state/        Zustand Store、版本迁移、存储适配与草稿提交协议
  templates/    模板插件契约、注册表、有效主题、共享渲染原子与模板样式
  editor/       modules、rich、source、fields、photo 与编辑器样式
  preview/      实时预览、分页调度、字体加载、PDF 导出与打印样式
  workspace/    工具栏、版本切换、样式设置、恢复提示与工作区布局
  shared/       通用 UI、Hooks、尺寸计算与 id 工具
```

| 包 | 允许依赖的项目内包 |
|---|---|
| `shared` | 无业务包依赖 |
| `resume` | `shared` |
| `templates` | `resume`、`shared` |
| `state` | `resume`、`templates`、`shared` |
| `editor`、`preview` | `resume`、`templates`、`state`、`shared` |
| `workspace` | 上述包，负责工作区控件组合 |
| `app` | 上述包，负责编辑器与预览的整页组装 |

`resume/model.ts` 仅以类型方式引用 `templates/registry.ts` 派生的 `TemplateId`，这是模型层唯一的模板引用，运行时仍严格遵循上表依赖方向。`resume` 不依赖 React、Zustand 或任何编辑器框架。编辑器与预览区通过 `resume/focus.ts` 的定位契约协作，互不导入对方组件；模板共享渲染原子统一由 `templates/rendering.tsx` 提供，模板不反向依赖预览编排。

跨包导入统一使用 `@/包名/具体模块`，包内使用相对路径，不设汇总全部实现的 barrel 入口。TypeScript 路径映射定义在 [tsconfig.json](../tsconfig.json)，Vite 与 Vitest 共用 [aliases.ts](../config/aliases.ts)，Paged.js UMD 脚本的别名入口也集中维护于此。`main.tsx` 按固定顺序引入各包样式，编辑器懒加载入口位于 `app/App.tsx`。

`@pagedjs-script?url` 用于向 iframe 提供经典脚本的静态资源地址。[vite.config.ts](../vite.config.ts) 按完整导入名将其列入 `optimizeDeps.exclude`，防止 Vite 开发模式在解析别名时误将其送入依赖预构建。由于仅检查生产构建无法覆盖该路径，涉及构建或别名改动时必须运行开发模式浏览器回归。

[包边界规则](../scripts/eslint/package-boundaries.mjs) 随 `npm run lint` 检查静态导入、动态导入、重导出与类型导入，对应回归用例位于 [tests/architecture](../tests/architecture)。新增跨包协作时应优先通过契约传递或在更上层组合；如确需调整依赖方向，须同步更新规则与本节说明。单元测试随所属包就近放置，浏览器端到端回归统一存放在 `tests/e2e`。

<a id="data-model"></a>

## 数据模型

入口：[resume/model.ts](../src/resume/model.ts)。

- `Resume.sections` 是简历正文的唯一数据源，涵盖基本信息、工作经历、教育背景、项目经验、技能与自定义模块。技能、个人简介与经历描述均以 Markdown 存储；无法识别的内容由 `custom` 模块兜底承接。
- `Resume.name` 表示简历版本名称，与基本信息中的候选人姓名相互独立；`workExperience` 为用户手动填写的短文本，不根据经历时间自动推算。
- 列表型经历统一使用 `DatedItem`：`rightText` 承载时间、地点或 GPA 等右侧信息，`description` 保存正文说明，`projects` 支持一级子项目嵌套。
- `theme` 保存文档级排版设置，独立模板覆盖项保存在 `templateThemeOverrides`；`layout` 记录模块显示顺序、主栏 / 侧栏归属及侧栏宽度，不改写 `sections` 原始顺序。
- 应用内部 `Resume.template` 使用注册表派生的字面量联合类型；外部输入 `ResumeInput` 接受任意字符串模板标识，存储边界的 `StoredResume` 允许旧版缺省主题字段，经读取规范化后统一转为合法的 `Resume`。

<a id="state"></a>

## 保存与兼容

入口：[useResumeStore.ts](../src/state/useResumeStore.ts)、[状态契约](../src/state/types.ts)、[版本迁移](../src/state/resumeMigrations.ts)、[读取规范化](../src/state/resumeNormalization.ts)、[debouncedStorage.ts](../src/state/storage/debouncedStorage.ts)。

- Zustand 持久化键固定为 `resume-maker:store`。版本迁移会同时遍历当前正文、历史快照、已删除记录以及解析撤销的 `previousSections`；读取规范化同样通用于主文档、历史记录、删除记录与外部导入。不得因品牌或界面调整重置用户数据，缺省字段应延续原有默认行为。
- [resumeMigrations.ts](../src/state/resumeMigrations.ts) 集中维护存储版本号与一次性迁移步骤，并通过公共遍历器覆盖所有历史容器；新增版本迁移时须同步处理历史容器，不能只更新主文档。[resumeNormalization.ts](../src/state/resumeNormalization.ts) 负责每次读取时的模板、主题与布局规范化，以及持久字段白名单合并，避免覆写 Store 操作函数。
- 兼容迁移保留早期 `start/end` → `rightText` 与项目 `techStack/summary` → `description` 的字段转换，并将旧默认标题「项目经历」一次性迁移为「项目经验」（用户自定义标题不受影响）。v11 将旧版技能 `groups` 转换为 Markdown `content`，完整保留分类与条目；当已存在字符串正文（含空字符串）时以正文为准，不回退覆盖。
- 普通编辑触发的历史快照按 30 秒间隔限频，每份简历最多保留 10 份；恢复快照前会先自动保存当前版本。模块编辑中的删除操作提供最多 5 条的连续撤销队列（单条提示持续 8 秒，撤销后展示上一条并重新计时，切换简历清空队列），且局部恢复不会覆盖删除后对其他字段的修改。
- 存储写入与编辑解析各自独立防抖：存储队列始终保留最新状态，在 500ms 停顿后统一编码并写入 localStorage，页面离开时同步 flush。若编码或写入失败，系统保留待写状态、展示错误提示并支持重试。历史快照与主数据存于同一浏览器存储中，不能替代外部备份。
- Store 必须坚持不可变更新。[stateSerialization.ts](../src/state/storage/stateSerialization.ts) 按顶层字段引用缓存最近一次序列化结果，使 UI 偏好变更可以复用未变动正文与快照的 JSON 片段，持久化格式仍保持同一键下的 `{ state, version }`。新增持久化字段时，须同步维护状态契约、`partialize`、读取校验与合并白名单。
- 启动读取时先经 [resumeStorageSchema.ts](../src/state/storage/resumeStorageSchema.ts) 与 [resumeHydration.ts](../src/state/storage/resumeHydration.ts) 校验存储封装、正文及历史结构，再执行迁移与合并；缺少版本号时按 v0 进入迁移链。v10 及更早版本允许缺少或为 `null` 的技能正文搭配合法旧 `groups`（分类与条目须为字符串）；遇到未知正文类型时不会强转或清空。若出现未来版本、JSON 损坏或结构异常，应用立即清空排队写入、锁定存储只读并进入恢复界面，提供原始 JSON 下载，直至重试读取成功后才解除保护。
- 首次使用的空状态仅在读取成功后由 `App` 注入示例简历，并防止 StrictMode 重复初始化；读取失败时严禁创建示例或覆盖原数据。新建简历（`createResume`）默认生成空白的「基本信息、工作经历、教育背景、技能」四个骨架模块，不预填字面量占位文本。编辑模式属于工作区状态，编辑器实例按简历 `id` 隔离。

<a id="editing"></a>

## 编辑与 Markdown 协议

入口：[ModularEditor](../src/editor/modules/ModularEditor.tsx)、[RichEditor](../src/editor/rich/RichEditor.tsx)、[SourceEditor](../src/editor/source/SourceEditor.tsx)；解析与序列化协议集中在 [resume/markdown](../src/resume/markdown)。

- **三模式同步与草稿提交**：模块表单的字段与富文本直接同步写回 `sections`；文档模式与源码模式维护即时草稿，在 400ms 防抖后解析回写，并通过 `dirtyRef` 与 `skipSyncRef` 防止外部覆盖和循环同步。切换模式、切换 / 新建 / 复制 / 删除简历、恢复快照、导入及导出前，均须先调用 `flushSync(flushActiveEditorDraft)` 提交草稿；恢复快照时先同步草稿、备份当前版本再应用历史内容，确保旧防抖不会覆盖恢复结果。页面隐藏或离开时严格按「草稿提交 → Store 更新 → 存储 flush」顺序执行，卸载清理仅作兜底。协议入口为 [editorDraft.ts](../src/state/editing/editorDraft.ts)。
- **命令层与表单级撤销**：模块表单的字段更新、增删（支持置顶或末尾插入条目）、深克隆复制（自动为条目及子项目分配新 `id`）、位置重排与局部删除撤销统一集中在 [commands.ts](../src/resume/commands.ts)。命令绑定简历 `id` 并通过 getter 读取最新状态，不依赖 React、DOM 或具体 Store，无效目标保留原对象引用。此外，[useModularHistory.ts](../src/editor/modules/useModularHistory.ts) 为模块表单提供统一撤销 / 重做栈（支持工具栏按钮与 `Ctrl/⌘ + Z`、`Ctrl/⌘ + Shift + Z`、`Ctrl + Y`），600ms 内的同结构连续输入合并为一步，结构与布局变动独立成步；当焦点位于富文本编辑框且存在局部历史时优先交由 Tiptap 处理，退空后无缝接管表单级撤销。
- **表单组织与交互细节**：`ModularEditor` 负责目录导航、折叠态管理、焦点定位与布局交互；[BasicsEditor](../src/editor/modules/BasicsEditor.tsx) 与 [ItemsEditor](../src/editor/modules/ItemsEditor.tsx) 组合具体表单，[ItemCard](../src/editor/modules/ItemCard.tsx) 与 [useItemDrag.ts](../src/editor/modules/useItemDrag.ts) 为经历和子项目提供指针拖拽及方向键排序。初始加载时非首条顶级经历与全部子项目默认折叠，父条目折叠态显示子项目数量；个人网站与 GitHub 已有内容时默认展开。键盘录入方面，模块标题按 `Enter` 自动展开并跳入首字段，单行输入支持 `Enter` / `Shift + Enter` 前后跳转，`MarkdownField` 工具栏移出默认 `Tab` 序列并支持 `Ctrl/⌘ + Enter`（配 `Shift` 返回）跳出多行框。链接面板支持同时编辑显示文字与地址、自动补全 `https://` 与一键移除；源码文本框随内容自动撑高；「更多格式」菜单提供 `||` 左右对齐快捷插入。时间字段按模块提供差异化引导与 `+ 至今` 快捷填充，联系方式在失焦时提供非阻塞格式提示（纯逻辑集中在 [formHelpers.ts](../src/editor/fields/formHelpers.ts)）。主要表单子组件均通过 `React.memo` 隔离重渲染。
- **Markdown 往返协议**：`serialize` 与 `parse` 保持双向往返一致。标题前的 `<!-- resume:{...} -->` 注释记录模块类型及各级 `id`，确保自定义标题、空模块与同名条目在三模式切换中不丢失身份；重复 `id` 会自动重新分配，不含标记的普通 Markdown 则继续走启发式解析并输出诊断提示。
- **元数据隔离与条目头语法**：`metadata.ts` 与 `ResumeStarterKit` 维护富文本中的结构标记，[sourceDocument.ts](../src/resume/markdown/sourceDocument.ts) 负责在源码视图中分离正文与隐藏标记——仅隐藏合法的顶层协议注释，不改写代码块示例与普通注释；源码语法高亮不参与解析，也不修改原始字符。条目头格式为 `### 名称 — 角色 || 时间`，一级子项目为 `#### 子项目：名称 — 角色 || 时间`（普通历史 H4 不会自动升级为子项目），`工作经验：…` 为基本信息中的独立可选段落。当名称或角色包含 `—`、`|`、反引号或 Markdown 特殊字符时，[itemHeading.ts](../src/resume/markdown/itemHeading.ts) 使用原生行内代码保存字面值（例如 ``### `平台 — 国内业务` — `开发 || 运维` || 2024 - 至今``），解析仅在引用外拆分分隔符，并继续兼容旧格式。
- **安全渲染与备份边界**：[render.ts](../src/resume/markdown/render.ts) 的输出全部经 DOMPurify 净化；正文与列表项均支持 `||` 左右对齐排版，联系信息通过 [plain.ts](../src/resume/markdown/plain.ts) 清洗行内格式；富文本仅开放与解析协议对应的 Markdown 语法。Markdown 备份包含正文、照片与结构标识，不包含模板、主题、预览布局与历史快照；导出前始终提交草稿并读取最新 Store，导入入口位于 [io.ts](../src/resume/markdown/io.ts)。

<a id="templates"></a>

## 模板、主题与布局

入口：[registry.ts](../src/templates/registry.ts)、[theme.ts](../src/templates/theme.ts)、[resume/layout.ts](../src/resume/layout.ts)、[共享渲染](../src/templates/rendering.tsx)。

- **模板注册与兼容**：注册表是唯一的模板清单——`TEMPLATES` 供选择器展示，`LEGACY_TEMPLATES` 保留历史版式。`TemplateId`、标签及查找函数均由此派生；遇到未知模板 `id` 时，组件与 CSS 类完整回退至经典模板。旧标识 `asu` 在读取边界自动映射为 `technicalCompact`，主题覆盖仅转换已知别名并保留未知模板键。
- **插件契约与样式隔离**：插件契约定义在 [templates/types.ts](../src/templates/types.ts)。各模板通过 `id: '模板名' as const` 与 `satisfies TemplatePlugin` 声明，避免 `id` 扩宽为 `string` 或维护重复的联合类型。模板由自身 `Body({ sections, layout })` 决定页面结构，预览主流程不写模板条件分支；样式通过 `.resume.{id}` 全局作用域类隔离（不改用 CSS Modules），模板可自由组合共享渲染原子或自定义条目组件。
- **主题作用域**：`themeScope` 默认为文档作用域，消费共享的 `resume.theme`；独立作用域模板通过 `DEFAULT_THEME + defaultTheme + templateThemeOverrides[id]` 计算有效主题。预览、缩略图、设置面板、字体加载与打印均通过 `resolveResumeTheme` 获取同一份有效主题。跨作用域切换模板不改写共享主题；独立模板字段设为 `undefined` 即移除该项覆盖，重置仅清空当前模板覆盖，保留旧文档共享主题与其他模板配置。
- **分栏与顺序布局**：`layout.order` 与 `layout.regions` 按模块 `id` 存储，新增模块自动追加，失效引用不会隐藏正文。单栏模板忽略但保留已有的分栏配置；双栏模板由插件 `sidebar` 声明默认侧栏模块与栏宽（允许范围 24%–45%）。左侧目录拖拽、右侧表单标题栏的 `主栏 / 侧栏` 一键切换与实时预览共用同一套布局工具；条目与子项目排序直接更新对应数组。
- **配色体系与对比度**：根节点注入 `--accent`、`--fs`、`--pad`、`--lh` 等排版变量（字号与历史边距采用 px），工作区 UI 的 `--ui-*` 变量与简历纸张主题完全隔离，切换深浅界面不会影响纸张配色。[themeColors.ts](../src/resume/themeColors.ts) 提供 6 个常用色（深蓝、墨灰、雾蓝、灰绿、深青、暖棕）和 2 个更多色（莓红、松绿）；配色面板仅更新 `primaryColor`，不改动字体、字号、间距、照片或布局，「整套风格」预设折叠收纳并在应用时明确覆盖颜色与排版。[colors.ts](../src/templates/colors.ts) 按 5:1 目标对比度从原始主色实时派生 `--accent-text/soft/line/band/on-band/on-dark`，正文保持中性色，不改写已存储的主色值，自定义与历史 CSS 颜色均走相同派生链路。

### 照片与双向定位

- [photo.ts](../src/resume/photo.ts) 负责校验、裁切与压缩本地位图（支持 JPG、PNG、WebP），默认居中裁切并支持缩放（1–2×）与水平 / 垂直偏移微调，最终统一输出 336×432（7:9）、体积受限的 JPEG data URL，不保存临时 blob URL 或外链图片。`BasicsData.photo` 作为独立图片段落随 Markdown 备份。
- 在模块表单中，未上传照片时点击头像框可直接一步打开文件选择器，头像框与设置弹窗均支持拖拽图片上传或替换；当前会话上传的照片支持在弹窗内实时微调裁切区域。`photoWidth` 属于主题排版字段（范围 56–140px，默认 84×108px），照片在简历中占独立列、简介通栏展示，无照片时不留空列，在侧栏中随可用宽度自适应缩小。
- [focus.ts](../src/resume/focus.ts) 通过简历、模块、条目、子项目 `id` 与字段名实现双向定位：预览 DOM 保留 `data-resume-*` 标识，分页后仍可精确定位后续页片段；编辑时仅更新高亮提示，显式点击定位才执行滚动，同时保障链接点击、文本选择与键盘操作不受干扰。

<a id="pdf"></a>

<a id="one-page"></a>

## 分页、智能一页与 PDF

入口：[ResumePreview](../src/preview/ResumePreview.tsx)、[resumePagination.ts](../src/preview/pagination/resumePagination.ts)、[paginationReady.ts](../src/preview/pagination/paginationReady.ts)、[pdf.ts](../src/preview/pdf.ts)。

1. 使用有效主题渲染隐藏的 A4 源 DOM，待字体与图片就绪后，在独立 iframe 内通过本地打包的 Paged.js 执行分页，最终页数直接取自真实分页结果。
2. 智能一页综合源内容高度与实际页数进行有限次临时压缩（压缩下限 0.85）；内容超出安全范围时自动恢复原主题与多页排版。压缩参数仅作用于渲染，不写回 Store，状态按 `resume.id:template` 隔离。
3. [paginationQueue.ts](../src/preview/pagination/paginationQueue.ts) 串行调度分页任务，同时最多保留一个运行中任务和一个最新待办。正文、有效主题或布局变更在停顿 200ms 后触发重排；首次加载、切换简历或切换模板立即调度；版本重命名与 UI 偏好变更不触发重排。过期结果不会发布，组件卸载时取消待办并在运行中任务结束后清理分页器。
4. 提交分页任务时即登记状态为计算中，计算中与失败状态不可视作已完成结果；分页状态同步反馈至预览区与编辑区底栏，方便窄屏与移动端实时掌握页数。发布结果时将同一批分页 DOM 与样式同步写入 `#resume-print-root` 供打印复用。
5. 点击导出 PDF 时立即推动待办分页并等待最新分页与图片解码完成（等待期间若有新任务则继续等待最新结果），随后临时设置文档标题并调用 `window.print()`。分页失败时阻断导出，禁止打印旧快照。PDF 由浏览器打印对话框另存生成，应用不内置独立 PDF 生成器。

分页与打印样式由 [main.tsx](../src/main.tsx) 统一引入：`print.css` 控制打印规则与防断页，`pagination.css` 切换打印根节点，`paged-document.css` 管理分页文档样式。Web 字体由 [fonts.ts](../src/preview/fonts.ts) 按需加载，离线时自动回退系统字体并可能影响行宽与分页，打印后仍须按[验证指南](VALIDATION.md#browser)核对实际 PDF。

<a id="extension"></a>

## 常见扩展

- **新增模板**：在 `src/templates/<id>/` 下创建 `index.tsx` 与对应样式文件，按 `as const` 与 `satisfies TemplatePlugin` 约定导出含 `id/label/bestFor/description/Body` 的插件并登记到注册表；按需声明 `sidebar` 或独立主题默认值，无需改动编辑与数据协议。
- **新增分节类型**：同步更新数据模型、[resume/sections.ts](../src/resume/sections.ts)、[resume/commands.ts](../src/resume/commands.ts)、[editor/modules/moduleConfig.ts](../src/editor/modules/moduleConfig.ts) 与模块表单、Markdown 的 `serialize` / `parse` / `metadata`，以及共享与模板专属渲染分发，并补充往返及历史缺省测试用例。模块配置和条目标签采用完整类型映射，渲染分发穷举 `Section`；扩展模型后先跑类型检查并补齐所有分支，避免盲目强转。
- **调整工作区布局**：目录宽度与响应式模式计算集中在 [workspaceLayout.ts](../src/shared/layout/workspaceLayout.ts)，导航与拖拽交互位于 [ModuleNavigation](../src/editor/modules/ModuleNavigation.tsx)。折叠状态保留字段实例与编辑撤销历史，自动收窄不覆盖用户手动设定的宽度偏好；调整 UI 后须复核焦点恢复与输入保存。

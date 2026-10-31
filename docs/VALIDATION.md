# 验证指南

本文维护检查方法与通过标准。安装见 [README](../README.md#setup)，单次结果写入 PR、提交说明或已有任务记录。

<a id="commands"></a>

## 命令与范围

在仓库根目录执行，命令依据 [package.json](../package.json)。检查须退出码为 0，并说明警告。

| 命令 | 用途与结论范围 |
|---|---|
| `npm run dev` | 启动开发服务，地址以终端为准；不代表流程通过 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | Vitest 单次测试，全部用例通过；只证明已有断言 |
| `npm run test:watch` | 本地监听调试，交付前仍记录单次结果 |
| `npm run test:e2e` | 自动构建并在 Chromium 桌面和 390px 手机视口运行真实浏览器回归，含 Vite 开发模式检查 |
| `npm run test:e2e:ui` | 打开 Playwright 交互调试界面 |
| `npm run lint` | 源码静态检查，警告不自动使脚本失败 |
| `npm run audit:deps` | 通过 npm 官方接口检查全部依赖的已知安全公告；退出码为 0 表示本次未报告漏洞，不代表不存在未知问题 |
| `npm run build` | 含类型检查，生成 `dist/`；不证明交互和 PDF 正确 |
| `npm run preview` | 构建后预览产物，再检查实际操作 |

[Vitest](../vitest.config.ts) 使用 Node 环境，包含各包的 `src/**/*.test.ts` 和 `tests/architecture/**/*.test.mjs` 包边界规则回归。[Playwright](../playwright.config.ts) 的业务 [E2E 用例](../tests/e2e) 在生产构建上运行，每例使用独立浏览器上下文和存储。外部字体请求被阻断，分页样本指定系统字体，避免测试依赖 CDN。

[开发模式回归](../tests/e2e/development.spec.ts) 额外使用项目的真实 Vite 配置启动开发服务，检查独立空缓存的冷启动、保留缓存后重启、分页资源加载、编辑更新、懒加载编辑器和刷新，并断言没有 Vite / 页面异常或本地 HTTP 错误。服务端口为 `4174 + Playwright parallelIndex`，端口占用直接报错；结束后关闭服务并删除临时缓存，不复用用户开发服务或依赖缓存。

[CI](../.github/workflows/deploy.yml) 使用 Ubuntu 24.04、Node 24 与 npm，PR 与 main 推送均执行 `npm ci` 安装、依赖审计、类型检查、test、lint 和 E2E；依赖审计中的 high / critical 告警会阻断流水线。E2E 启动前构建包含源码与测试的类型检查。检查通过后 main 才部署，PR 不部署。浏览器报告和失败 trace / 截图保留 7 天。

首次运行 E2E 前安装 Chromium：

```bash
npx playwright install chromium
npm run test:e2e
npx playwright show-report output/playwright/report
```

Linux CI 使用 `npx playwright install --with-deps chromium`。测试启动自己的 `127.0.0.1:4173` 预览服务，退出后自动关闭服务、页面与浏览器；端口占用会报错，不复用或关闭其他服务。产物在忽略提交的 `output/playwright/` 中。

<a id="selection"></a>

## 按改动检查

代码改动运行 `npm test`、`npm run lint`、`npm run build`，涉及编辑、存储或分页交互时再运行 `npm run test:e2e`（包含构建，可代替单独 build）。单元测试放在各包的 `__tests__` 中，例如 [Markdown](../src/resume/markdown/__tests__)、[状态恢复](../src/state/__tests__)和[分页](../src/preview/pagination/__tests__)；跨包约束见[架构测试](../tests/architecture)，浏览器流程见 [E2E](../tests/e2e)。

| 改动 | 通过标准 |
|---|---|
| 编辑与 Markdown | 三模式往返保留正文、类型与 id，覆盖改名、空模块、同名条目、照片和子项目；输入法、选择和撤销正常 |
| 保存与恢复 | 输入后立即切模式、切简历、新建、复制、导出或刷新不丢末次输入且不串写；失败重试、快照与删除撤销可用；旧版字段同时覆盖主文档与所有历史容器 |
| 模板与布局 | 新旧模板可渲染、切换与打印，主题作用域不互相覆盖，排序和分栏无遗漏，刷新与重置正确 |
| 工作区 | 深浅主题、宽屏、最窄编辑区和手机可用；拖拽、方向键、Esc、跨页定位及焦点恢复符合约定 |
| 依赖与锁文件 | 在独立目录按 CI 的 Node / npm 版本执行 `npm ci`，再运行依赖审计、单元测试、lint 和完整 E2E（包含类型检查与构建）；避免由上级目录的 `node_modules` 隐式补齐缺失依赖 |
| 分包与导入 | `@/` 在 TypeScript、开发、测试和生产构建中解析一致；懒加载编辑器及分页资源可用；包边界 lint 与规则回归通过 |
| 分页与 PDF | 执行下节实际文件检查，不能用纯逻辑测试代替 |

依赖审计固定使用 npm 官方 registry，避免镜像缺少审计接口造成误判。ESLint 和 TypeScript ESLint 的检查链当前仍引用 minimatch 10；`package.json` 中的版本范围覆盖将受影响的 minimatch 10 升级到安全修复版本 11。升级检查工具后应复核是否可以移除此覆盖。

<a id="browser"></a>

## 浏览器与 PDF

用示例数据运行开发服务或产物，记录系统、浏览器版本、视口、模板、主题及字体加载 / 回退情况。项目未声明正式浏览器支持矩阵，结果仅适用于被测环境。

1. 覆盖受影响模板；改共享渲染或打印规则时包含单栏、现代双栏、技术精简及相关历史版式。样本覆盖一页、略超一页和 2–3 页，按需加入中文混排、长链接、列表、`||`、照片和子项目。
2. 检查智能一页开关、压缩失败恢复、快速输入与切换、计算中和错误状态；只发布最新分页，失败不能导出旧快照。
3. 另存为 PDF 时使用 A4、100% 缩放并关闭页眉页脚。打开文件，对照预览检查页数、断行与内容一致，无遮挡、漏内容、意外空白页或工具栏，文本可选取 / 搜索、链接可用。

现有 E2E 覆盖异常数据保护与原始备份、恢复后重试、源码 / 富文本防抖期间恢复快照、三模式切换与立即刷新、多简历隔离、分隔符字段及照片 / 子项目的 Markdown 备份导入，以及三类模板的最新分页打印、旧快照导出阻断。打印调用使用桩记录快照，随后用 Chromium `page.pdf()` 生成真实 PDF，校验文件头与页数并附到报告；尚不能替代中文可搜索性、链接、视觉排版和原生打印对话框的验收。

[模块操作回归](../tests/e2e/modules.spec.ts) 覆盖删除经历或子项目、编辑其他内容后撤销、刷新以及自定义标题跨模式同步；[恢复回归](../tests/e2e/recovery.spec.ts) 同时检查未知模板的组件 / CSS 回退与未来覆盖保留、v1 快照的日期和项目正文迁移。命令层测试检查无效目标与重复撤销保留引用，迁移测试检查所有历史容器和原始输入不变；类型检查约束模板 id、配置完整性与分节渲染分支。

[性能回归](../tests/e2e/performance.spec.ts) 用可控时钟检查真实 Paged.js 调用和 localStorage 写入次数：连续输入合并、重命名不重排、导出推动待办、运行中旧任务不发布，以及大历史数据下偏好更新复用编码。JSON 计数附在 HTML 报告中；这些断言证明调度和编码次数，不能代替低端设备上的帧率、长任务或输入延迟测量。

人工或自动化均可。agent-browser 自建会话须命名、保持 10 分钟空闲超时，结束或中断后关闭同一会话；附着用户浏览器时设 `--idle-timeout 0` 且不关闭它。只清理本任务产生的临时材料。

<a id="documentation"></a>

## 纯文档改动

核对内容、相对链接、锚点、代码路径、命令依据及移动 / 删除后的引用，运行 `git diff --check` 并检查新文件。无需重跑无关构建或新增报告；仓库暂无文档检查脚本，可用临时检查器辅助核对。

<a id="results"></a>

## 记录结果

写清被测提交或基于哪个 HEAD 的改动范围、环境与工具版本、实际命令 / 场景、结果、证据位置及未覆盖项。未执行项明确注明，失败如实记录；没有持久证据就说明。历史通过不代表当前通过，长期证据更新条件见[维护规则](../CONTRIBUTING.md#documentation)。

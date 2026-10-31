import type { Resume } from './model'
import { DEFAULT_THEME } from './model'
import { uid } from '@/shared/lib/id'

// 首次体验使用的虚构示例，覆盖各模块、Markdown 排版与一级子项目。
export function createSampleResume(): Resume {
  return {
    id: uid(),
    name: '示例简历 · 张三',
    template: 'classic',
    theme: { ...DEFAULT_THEME },
    updatedAt: Date.now(),
    sections: [
      {
        id: uid(),
        type: 'basics',
        title: '基本信息',
        data: {
          name: '张三',
          title: '资深前端工程师',
          workExperience: '7 年工作经验',
          contact: {
            phone: '138-0000-0000',
            email: 'zhangsan@example.com',
            location: '上海',
            website: 'https://example.com/zhangsan',
            github: 'github.com/zhangsan',
          },
          summary: '七年前端开发经验，专注复杂业务系统、前端工程化与性能优化。具备从需求拆解、技术方案到上线监控的完整交付经验，曾带领 5 人团队建设直播中台，推动组件复用、自动化测试和发布流程落地。',
        },
      },
      {
        id: uid(),
        type: 'experience',
        title: '工作经历',
        data: {
          items: [
            {
              id: uid(),
              title: '字节跳动',
              subtitle: '高级前端工程师',
              rightText: '2021.06 - 至今',
              description:
                '- 主导直播中台前端架构升级，通过路由拆包、资源预加载和缓存治理，将首屏加载时间从 3.2s 降至 1.1s\n- 设计微前端接入规范，支撑 12 个业务线独立部署，发布效率提升 40%\n- 带领 5 人小组完成 Webpack 到 Vite 迁移，构建提速 8 倍，统一代码检查与发布流水线\n- 建立核心链路 E2E 测试、错误告警和灰度回滚机制，问题平均定位时间从 45 分钟缩短至 15 分钟',
              projects: [
                {
                  id: uid(),
                  title: '研发交付工具链',
                  subtitle: '核心开发',
                  rightText: '2024.01 - 2024.10',
                  description:
                    '- 将构建、预发校验与产物归档接入统一流水线，按环境管理配置，支持分批发布与回滚\n- 为 12 个业务线维护迁移清单和排障手册，通过结对调试帮助新成员独立完成版本交付',
                },
                {
                  id: uid(),
                  title: '直播运营工作台',
                  subtitle: '前端负责人',
                  rightText: '2023.04 - 2024.08',
                  description:
                    '- 将直播排期、审核和数据复盘整合到统一工作台，覆盖 6 类运营角色\n- 抽象权限模型与分步表单，支持草稿恢复、流程校验和操作审计，运营配置耗时降低 35%',
                },
              ],
            },
            {
              id: uid(),
              title: '腾讯',
              subtitle: '前端工程师',
              rightText: '2019.07 - 2021.05',
              description:
                '- 负责微信小程序商品、购物车与订单模块开发，累计服务 2000 万用户\n- 抽象通用业务组件库，被 8 个团队复用，重复开发工作量降低 60%\n- 完善弱网重试、请求去重和异常埋点，与后端协作梳理订单状态，补齐下单与支付回调的回归用例',
            },
          ],
        },
      },
      {
        id: uid(),
        type: 'skills',
        title: '技能',
        data: {
          content:
            '- **语言基础**：JavaScript / TypeScript，熟悉事件循环、浏览器渲染、网络缓存与常用数据结构\n- **前端框架**：React / Vue 3，能够拆分复杂页面、设计状态模型并编写可复用组件\n- **工程化**：Vite / Webpack / Monorepo，具备依赖治理、构建优化与 CI/CD 落地经验\n- **质量与性能**：Vitest / Playwright，覆盖组件测试、核心链路回归、性能分析与无障碍检查\n- **服务与协作**：Node.js / REST API / WebSocket，熟悉接口契约、代码评审与技术文档维护',
        },
      },
      {
        id: uid(),
        type: 'projects',
        title: '项目经验',
        data: {
          items: [
            {
              id: uid(),
              title: '前端质量与性能监控平台',
              subtitle: '项目负责人',
              rightText: '2024.09 - 至今',
              description:
                '汇总多业务线的页面性能、运行时异常与发布版本，为灰度验证和线上回归排查提供统一入口。\n\n**技术栈**：React / TypeScript / Node.js / Web Vitals\n\n1. 统一错误采集与上下文规范，通过 Source Map 关联源码和发布版本，支持异常聚合与问题追踪\n2. 建设页面加载、交互响应和接口耗时面板，按版本、设备与地区筛选，定位大资源和慢请求\n3. 在 CI 中加入包体积预算与核心页面回归，发布前生成性能对比报告，提前发现资源增长\n4. 与后端协作设计告警去重、事件采样和灰度验证流程，为故障回滚保留可追溯记录',
            },
            {
              id: uid(),
              title: '企业级组件库与研发脚手架',
              subtitle: '核心维护者',
              rightText: '2022.01 - 2023.12',
              description:
                '统一内部业务系统的组件规范与项目起步流程，减少各团队重复维护基础设施。\n\n**技术栈**：React / TypeScript / Storybook / Vitest / Vite\n\n1. 建设 40 余个基础与业务组件，提供交互示例、类型定义和版本迁移说明\n2. 将权限、请求、埋点与测试配置沉淀为脚手架，新项目初始化从 2 天缩短至半天\n3. 建立组件回归测试与变更日志，按灰度版本验证升级，服务 8 个业务团队',
            },
            {
              id: uid(),
              title: '可视化数据看板平台',
              subtitle: '主导开发',
              rightText: '2020.03 - 2021.01',
              description:
                '面向运营的实时数据可视化平台，支持自定义拖拽看板与多数据源接入。\n\n**技术栈**：React / D3 / TypeScript / WebSocket\n\n1. 基于配置 Schema 构建拖拽画布，提供 50 余种图表、筛选联动与看板模板\n2. 通过 WebSocket 增量更新与虚拟滚动支撑万级数据点交互，减少整页重复渲染\n3. 增加看板版本记录、异常数据提示和权限校验，支持运营团队自行搭建与回滚配置',
            },
          ],
        },
      },
      {
        id: uid(),
        type: 'education',
        title: '教育背景',
        data: {
          items: [
            {
              id: uid(),
              title: '复旦大学',
              subtitle: '计算机科学 本科',
              rightText: '2015.09 - 2019.06',
              description: '- GPA 3.8/4.0，专业排名前 5%\n- 主修数据结构、计算机网络、操作系统与数据库系统，毕业设计为浏览器端数据可视化工具\n- ACM 区域赛银奖，担任校内算法训练队成员',
            },
          ],
        },
      },
      {
        id: uid(),
        type: 'custom',
        title: '开源与技术分享',
        data: {
          title: '开源与技术分享',
          content: '- 持续维护前端组件示例与性能排查笔记，整理可复现的最小案例和测试脚本\n- 组织 8 次团队技术分享，主题包括 React 状态管理、构建迁移、浏览器性能分析与前端测试',
        },
      },
      {
        id: uid(),
        type: 'custom',
        title: '荣誉奖项',
        data: {
          title: '荣誉奖项',
          content: '- 字节跳动 2022 年度优秀员工\n- 腾讯 IEG 季度之星',
        },
      },
    ],
  }
}

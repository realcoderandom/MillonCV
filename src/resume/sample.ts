import type { Resume } from './model'
import { DEFAULT_THEME } from './model'
import { uid } from '@/shared/lib/id'

// 示例简历 —— 内容对应 legacy/index.html 中的 SAMPLE
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
          contact: {
            phone: '138-0000-0000',
            email: 'zhangsan@example.com',
            location: '上海',
            website: '',
            github: 'github.com/zhangsan',
          },
          summary: '五年前端开发经验，专注于大型 Web 应用架构与性能优化，主导过日活百万级产品的前端重构。',
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
                '- 主导直播中台前端架构升级，首屏加载时间从 3.2s 降至 1.1s\n- 设计微前端方案，支撑 12 个业务线独立部署，发布效率提升 40%\n- 带领 5 人小组完成 Webpack 到 Vite 迁移，构建提速 8 倍',
            },
            {
              id: uid(),
              title: '腾讯',
              subtitle: '前端工程师',
              rightText: '2019.07 - 2021.05',
              description:
                '- 负责微信小程序电商模块开发，累计服务 2000 万用户\n- 抽象通用业务组件库，被 8 个团队复用，降低重复开发 60%',
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
            '- **语言**：JavaScript / TypeScript / Go\n- **框架**：React / Vue 3 / Node.js\n- **工程化**：Vite / Webpack / Monorepo / CI/CD',
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
              title: '可视化数据看板平台',
              subtitle: '主导开发',
              rightText: '2020.03 - 2021.01',
              description:
                '面向运营的实时数据可视化平台，支持自定义拖拽看板与多数据源接入。\n\n**技术栈**：React / D3 / TypeScript / WebSocket\n\n1. 基于 React + D3 构建可拖拽看板，支持 50+ 图表类型\n2. 实现虚拟滚动与增量渲染，万级数据点流畅交互\n3. 开源后获 GitHub 2.3k Star',
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
              description: '- GPA 3.8/4.0，专业排名前 5%\n- ACM 区域赛银奖',
            },
          ],
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

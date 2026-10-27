import type { ItemSection, SectionType } from '@/resume/model'
import type { LucideIcon } from 'lucide-react'
import { Briefcase, Code2, FileText, Folder, GraduationCap, UserRound } from 'lucide-react'

export const MODULE_CONFIG = {
  basics: { icon: UserRound, description: '姓名、联系方式与个人简介' },
  experience: { icon: Briefcase, description: '公司、职位、时间与工作内容' },
  education: { icon: GraduationCap, description: '学校、专业与学习经历' },
  projects: { icon: Folder, description: '项目、角色与项目成果' },
  skills: { icon: Code2, description: '专业技能、工具与技术栈' },
  custom: { icon: FileText, description: '证书、荣誉或其他内容' },
} satisfies Record<SectionType, { icon: LucideIcon; description: string }>

export interface ItemLabels {
  noun: string
  title: string
  subtitle: string
  description: string
  subtitlePlaceholder: string
  placeholder: string
  hint: string
}

export const ITEM_LABELS = {
  experience: {
    noun: '经历', title: '公司名称', subtitle: '职位', description: '工作描述',
    subtitlePlaceholder: '如：高级前端工程师', placeholder: '分条描述你的工作职责、贡献与成果…',
    emptyHint: '记录你的工作职责，突出贡献与成果', hint: '写清你做了什么，以及带来的具体成果。',
  },
  education: {
    noun: '教育经历', title: '学校名称', subtitle: '专业与学位', description: '教育补充说明',
    subtitlePlaceholder: '如：计算机科学 · 本科', placeholder: '补充专业成绩、研究方向或校园经历…',
    emptyHint: '填写学校、专业与学位，补充学习经历', hint: '可补充成绩、研究方向或与岗位相关的学习经历。',
  },
  projects: {
    noun: '项目', title: '项目名称', subtitle: '担任角色', description: '项目描述',
    subtitlePlaceholder: '如：项目负责人', placeholder: '介绍项目背景、你的贡献和最终成果…',
    emptyHint: '介绍你参与的项目，展示解决问题的能力', hint: '围绕项目背景、你的贡献与最终成果展开。',
  },
  subproject: {
    noun: '子项目', title: '子项目名称', subtitle: '担任角色', description: '子项目描述',
    subtitlePlaceholder: '如：核心开发者', placeholder: '描述你在这个子项目中的工作与成果…', hint: '聚焦这个子项目中的工作与成果。',
  },
} satisfies Record<ItemSection['type'], ItemLabels & { emptyHint: string }> & Record<'subproject', ItemLabels>

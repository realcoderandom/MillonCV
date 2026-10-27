// 商务模板 —— 顶部主色色带（basics）+ 主体（其余分节）
import type { Section } from '@/resume/model'
import { SectionView } from '../rendering'
import type { TemplatePlugin } from '../types'
import './professional.css'

function Body({ sections }: { sections: Section[] }) {
  const basics = sections.filter((s) => s.type === 'basics')
  const rest = sections.filter((s) => s.type !== 'basics')
  return (
    <>
      <div className="pf-head">{basics.map((section) => <SectionView key={section.id} section={section} />)}</div>
      <div className="pf-body">
        {rest.map((s) => (
          <SectionView key={s.id} section={s} />
        ))}
      </div>
    </>
  )
}

export const professional = {
  id: 'professional' as const,
  label: '商务',
  bestFor: '管理岗 · 商业与咨询',
  description: '正式色带，建立专业第一印象',
  Body,
  defaultTheme: { primaryColor: '#1a365d' },
} satisfies TemplatePlugin

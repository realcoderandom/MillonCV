import { Briefcase, ChevronRight, Github, Globe, History, Mail, MapPin, Phone } from 'lucide-react'
import type { BasicsSection, Resume } from '@/resume/model'
import type { ResumeCommands } from '@/resume/commands'
import { ResumePhotoControl } from '../photo/ResumePhotoControl'
import { ModuleField } from '../fields/ModuleField'
import { MarkdownField } from '../fields/MarkdownField'

const CONTACT_FIELDS = [
  { key: 'phone', label: '电话', type: 'tel', icon: Phone, placeholder: '方便联系的手机号', autoComplete: 'tel' },
  { key: 'email', label: '邮箱', type: 'email', icon: Mail, placeholder: '用于接收面试邀请', autoComplete: 'email' },
  { key: 'website', label: '个人网站', type: 'url', icon: Globe, placeholder: '作品集或个人主页地址', autoComplete: 'off' },
  { key: 'github', label: 'GitHub', type: 'url', icon: Github, placeholder: 'github.com/你的用户名', autoComplete: 'off' },
] as const

export function BasicsEditor({ section, resume, commands }: { section: BasicsSection; resume: Resume; commands: ResumeCommands }) {
  const { data } = section
  const websiteCount = [data.contact.website, data.contact.github].filter(Boolean).length
  const contactField = (field: typeof CONTACT_FIELDS[number]) => <ModuleField
    key={field.key} field={field.key} label={field.label} type={field.type} icon={field.icon}
    autoComplete={field.autoComplete} placeholder={field.placeholder} value={data.contact[field.key]}
    onChange={(value) => commands.patchContact(section.id, { [field.key]: value })}
  />
  return <>
    <div className="module-identity">
      <div className="module-identity-fields">
        <ModuleField field="name" label="姓名" variant="name" autoComplete="name" placeholder="你的姓名" value={data.name} onChange={(name) => commands.patchBasics(section.id, { name })} />
        <ModuleField field="title" label="求职职位" icon={Briefcase} autoComplete="organization-title" placeholder="你希望申请的职位" value={data.title} onChange={(title) => commands.patchBasics(section.id, { title })} />
      </div>
      <div className="module-photo-field" data-resume-field="photo"><ResumePhotoControl resume={resume} variant="portrait" /></div>
    </div>
    <div className="module-field-grid">
      <ModuleField field="workExperience" label="工作经验" optional icon={History} placeholder="如：5 年工作经验" value={data.workExperience ?? ''} onChange={(value) => commands.patchBasics(section.id, { workExperience: value || undefined })} />
      <ModuleField field="location" label="所在地" icon={MapPin} autoComplete="address-level2" placeholder="如：上海" value={data.contact.location} onChange={(location) => commands.patchContact(section.id, { location })} />
    </div>
    <div className="module-form-group">
      <div className="module-form-divider"><h3>联系方式</h3><span>按需填写，空项不会显示</span></div>
      <div className="module-field-grid">{CONTACT_FIELDS.slice(0, 2).map(contactField)}</div>
      <details className="module-optional-fields">
        <summary><Globe size={14} /><span className="module-optional-title">个人网站与 GitHub</span><span className="module-optional-status">{websiteCount ? `${websiteCount} 项已填写` : '选填'}</span><ChevronRight size={14} className="module-optional-chevron" /></summary>
        <div className="module-field-grid">{CONTACT_FIELDS.slice(2).map(contactField)}</div>
      </details>
    </div>
    <MarkdownField field="summary" label="个人简介" placeholder="简要介绍你的经验、方向和优势…" hint="用两三句话说明你的经验、方向与优势。" value={data.summary} onChange={(summary) => commands.patchBasics(section.id, { summary })} />
  </>
}

import { fileURLToPath, URL } from 'node:url'
import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { packageBoundaries } from '../../scripts/eslint/package-boundaries.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only
const filename = (name) => fileURLToPath(new URL(`../../src/${name}`, import.meta.url))
const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } })

tester.run('包依赖边界', packageBoundaries, {
  valid: [
    { filename: filename('app/App.tsx'), code: "const Editor = import('@/editor/rich/RichEditor')" },
    { filename: filename('resume/model.ts'), code: "import type { TemplateId } from '@/templates/registry'" },
    { filename: filename('resume/model.ts'), code: "import { type TemplateId } from '@/templates/registry'" },
    { filename: filename('resume/model.ts'), code: "type TemplateId = import('@/templates/registry').TemplateId" },
    { filename: filename('resume/commands.ts'), code: "import { uid } from '@/shared/lib/id'" },
    { filename: filename('resume/markdown/parse.ts'), code: "import { parseItemHeading } from './itemHeading'" },
    { filename: filename('templates/rendering.tsx'), code: "import type { Section } from '@/resume/model'" },
    { filename: filename('state/useResumeStore.ts'), code: "import { selectResumeTemplate } from '@/templates/theme'" },
    { filename: filename('preview/pagination/resumePagination.ts'), code: "import url from '@pagedjs-script?url'" },
    { filename: filename('workspace/PreviewToolbar.tsx'), code: "import { ResumePhotoControl } from '@/editor/photo/ResumePhotoControl'" },
  ],
  invalid: [
    { filename: filename('lib/misc.ts'), code: 'export const value = 1', errors: [{ messageId: 'unregistered' }] },
    { filename: filename('shared/ui/Button.tsx'), code: "import { useResumeStore } from '@/state/useResumeStore'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('resume/model.ts'), code: "import { TEMPLATE_LABELS } from '@/templates/registry'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('resume/layout.ts'), code: "import type { TemplateId } from '@/templates/registry'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('templates/rendering.tsx'), code: "import { ResumePreview } from '@/preview/ResumePreview'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('state/useResumeStore.ts'), code: "const Toolbar = import('@/workspace/Toolbar')", errors: [{ messageId: 'dependency' }] },
    { filename: filename('editor/modules/ModularEditor.tsx'), code: "import { PreviewToolbar } from '@/workspace/PreviewToolbar'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('preview/layout.ts'), code: "import type { Props } from '@/editor/modules/ModularEditor'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('shared/lib/id.ts'), code: "export { useResumeStore } from '@/state/useResumeStore'", errors: [{ messageId: 'dependency' }] },
    { filename: filename('shared/lib/id.ts'), code: "type State = import('@/state/types').ResumeState", errors: [{ messageId: 'dependency' }] },
    { filename: filename('resume/commands.ts'), code: "import { uid } from '../shared/lib/id'", errors: [{ messageId: 'alias' }] },
    { filename: filename('resume/commands.ts'), code: "import { useState } from 'react'", errors: [{ messageId: 'external' }] },
    { filename: filename('preview/pagination/resumePagination.ts'), code: "import url from '../../../node_modules/pagedjs/dist/paged.min.js?url'", errors: [{ messageId: 'outside' }] },
  ],
})

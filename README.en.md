# MillonCV

[简体中文](README.md) | English

**A clear, professional resume for your next step toward a higher salary.**

MillonCV is a resume editor and layout tool that runs in your browser. Organize your experience with module forms, edit it as a document or Markdown, see live A4 pagination, and save a PDF through your browser's print dialog.

[Features](#features) · [Quick start](#setup) · [Usage](#usage) · [Screenshots](#screenshots) · [Data and backups](#data) · [Development](#development)

![MillonCV desktop workspace with module forms on the left and a live A4 resume preview on the right](docs/images/workspace.png)

No account, backend service, or environment variables are required. Resumes are saved in the current browser, and you can keep separate versions for different roles.

The interface is currently in Chinese. The usage steps below include the Chinese labels shown in the app.

<a id="features"></a>

## Features

| Feature | What you can do |
|---|---|
| Three editing modes | Fill in module forms, write in the document editor, or edit Markdown directly; all three modes share the same resume content |
| Experience and modules | Manage work experience, projects, education, skills, and custom modules; add one level of subprojects, reorder modules, and arrange main and sidebar columns in supported templates |
| Templates and typography | Choose from seven templates; adjust colors, fonts, font sizes, line spacing, margins, and headings; upload a photo and change its display size |
| Live paginated preview | See the actual A4 page count, click preview content to locate its editor field, and use Smart One Page to tighten content that slightly exceeds one page while preserving readability |
| Multiple resumes and recovery | Create, duplicate, rename, and switch resumes; save locally, restore historical snapshots, and undo deletion |
| Backups and export | Import and export Markdown, save PDFs through browser printing, and switch between editing and preview on mobile |

Available templates: **Classic (经典), Technical Compact (技术精简), Academic (学术), Accent (重点色), Minimal (简约), Business (商务), and Modern (现代)**. Five legacy templates remain supported so existing resumes retain their original layouts.

<a id="setup"></a>

## Quick start

Use Node.js **20.19+ on 20.x, 22.13+ on 22.x, or 24+**, with the npm version bundled with Node.js. From the project root, run:

```bash
npm ci
npm run dev
```

Open the local URL printed in your terminal. The default is `http://localhost:5173`; if that port is occupied, use the URL Vite reports. The first visit loads a sample resume, which you can edit or replace with a new one.

To preview a production build:

```bash
npm run build
npm run preview
```

The app runs entirely in the browser. Build output is written to `dist/` and can be hosted by a static site service.

<a id="usage"></a>

## Usage

1. **Create a version for a role.** Open the resume name menu in the top toolbar to create or duplicate a resume. The version name is separate from the person's name in the resume, so you can keep different versions for different applications.
2. **Fill in and organize your experience.** Module editing (`模块编辑`) is the default. Fill in fields, add experience entries, subprojects, or custom modules, and use the module navigation to change their order. Templates with two columns also let you arrange the main and sidebar content.
3. **Choose an editing mode.** Use the menu at the top left of the editor to switch between module editing (`模块编辑`), document editing (`文档编辑`), and Markdown. Click preview content to locate its form field. On mobile, use Preview (`预览`) and the return button to switch views.
4. **Adjust the layout.** Use the preview toolbar to choose a template, upload a photo, and adjust its size. Colors (`配色`) offers six common colors and two additional choices while preserving typography. A complete style (`整套风格`) applies color, font, and spacing together; Layout (`排版`) lets you adjust individual settings.
5. **Check saving and make a backup.** Check the save status in the top toolbar, restore a snapshot, or undo a deletion when needed. Back Up Markdown (`备份 Markdown`) exports the current content. Import is available under More File Actions (`更多文件操作`).
6. **Save a PDF.** Click Export PDF (`导出 PDF`) and wait for pagination and fonts to be ready. In the browser print dialog, choose **Save as PDF, A4, 100% scale, and no headers or footers**. Enable background graphics if you want the template colors. Open the saved file to check page count and line breaks.

Smart One Page (`智能一页`) is intended for resumes that slightly exceed one page. Longer content retains readable text sizes and multiple pages; you may still need to shorten it. The final PDF filename is controlled by the browser's save dialog.

<a id="screenshots"></a>

## Screenshots

### Choose a template for the role

Seven layouts include single columns, compact layouts, and sidebars. You can adjust colors and typography after choosing a template.

![Template picker showing Classic, Technical Compact, Academic, Accent, Minimal, Business, and Modern](docs/images/templates.png)

<details>
<summary>Markdown in the dark workspace</summary>

Edit source and see the layout side by side. Switching the workspace between light and dark themes does not change the resume paper colors.

![Dark workspace with highlighted Markdown on the left and a white resume preview on the right](docs/images/markdown-dark.png)

</details>

### Edit and preview on mobile

Edit individual fields, then switch to the full page preview to check the layout.

| Module editor | A4 preview |
|:---:|:---:|
| <img src="docs/images/mobile-editor.png" alt="Mobile module editor with name, target role, contact details, and summary fields" width="300"> | <img src="docs/images/mobile-preview.png" alt="Mobile A4 resume preview with pagination, template, and color controls" width="300"> |

Screenshots were captured in local Chromium at desktop and mobile viewports of 1440 × 1080 and 390 × 844, using fictional sample content and system fonts. Images are stored in [`docs/images/`](docs/images/).

<a id="data"></a>

## Data and backups

Resumes are saved automatically in **localStorage for the current browser and site**. There is no cloud sync. Changing browsers, devices, site addresses, or ports does not transfer your resumes automatically. Clearing site data deletes local content, and historical snapshots are not a substitute for an external backup.

| Format | What it contains | When to use it |
|---|---|---|
| Browser autosave | Multiple resumes, content, styles, layouts, and historical snapshots | Continue editing in the same browser and site |
| Markdown backup | The current resume content, photo, and structure markers; excludes templates, themes, preview layouts, and snapshots | Keep editable content or move it to another browser or device; import uses the Classic template and default theme |
| PDF | The final paginated document with its current layout | Submit or share a resume; keep browser data or a Markdown backup if you want to edit it later |

If local data cannot be read, the app pauses writes and offers the original JSON for download. Keep that backup before investigating permissions or data problems. This JSON is for recovery and troubleshooting; it cannot be imported as Markdown.

<a id="troubleshooting"></a>

## Troubleshooting

| Problem | What to do |
|---|---|
| Dependencies fail to install | Check Node.js and npm versions, then use the installation log to investigate network or proxy settings |
| Saving fails | Retry and export Markdown first, then check browser storage limits; do not start by clearing site data |
| A resume cannot be read after an update | Legacy skill groups are migrated automatically; if an error remains, download the original JSON before investigating and keep the site data |
| Markdown structure is recognized incorrectly | Read the parsing notice, undo parsing if needed, or edit in module mode; preserve structure markers in backup files |
| Imported content has different styling | Markdown does not include templates, themes, preview layouts, or snapshots; choose the style again after importing |
| Fonts or PDF layout change | Web fonts rely on a CDN and fall back to system fonts when unavailable; wait for fonts and pagination, check print settings, and inspect the saved PDF |

Preview and printing share the same paginated pages. Check the actual PDF for line breaks, links, and missing content. The project does not yet declare a formal browser support matrix; see the [validation guide](docs/VALIDATION.md#browser) for the tested scope.

<a id="development"></a>

## Development and contributing

The main stack is **React 18 · TypeScript · Vite · Zustand · Tiptap · Paged.js**. Architecture, data flow, template extensions, and editing protocols are documented in the [development guide](docs/DEVELOPMENT.md). Read the [contribution and documentation guidelines](CONTRIBUTING.md) before making changes. These development documents are currently in Chinese.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run unit and architecture tests |
| `npm run lint` | Run static checks |
| `npm run audit:deps` | Audit dependency security through the official npm registry |
| `npm run build` | Check types and create a production build |
| `npm run test:e2e` | Build and run Chromium regressions at desktop and mobile viewports |

Before the first E2E run, install Chromium with `npx playwright install chromium`. See the [validation guide](docs/VALIDATION.md) for check selection, acceptance criteria, and browser report locations. Submissions should explain the reason for the change, relevant documentation updates, actual validation, and any gaps in coverage.

[Agent instructions](AGENTS.md) · [Contribution guide](CONTRIBUTING.md) · [Architecture and engineering conventions](docs/DEVELOPMENT.md) · [Validation guide](docs/VALIDATION.md)

## License

This project is licensed under the [MIT License](LICENSE). Third-party dependencies and fonts retain their own licenses.

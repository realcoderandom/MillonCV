import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/app/App'
import '@/app/styles/tailwind.css'
import '@/app/styles/ui-theme.css'
import '@/app/styles/ui-controls.css'
import '@/templates/shared.css'
import '@/editor/styles/rich-editor.css'
import '@/workspace/workspace.css'
import '@/editor/styles/modular-editor.css'
import '@/preview/styles/print.css'
import '@/preview/styles/pagination.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

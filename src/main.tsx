import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErpApp } from './ErpApp.tsx'
import { applyChoice, readChoice, sessionAccount } from './theme.ts'
import './index.css'

applyChoice(readChoice(sessionAccount()))

const root = document.getElementById('root')
if (!root) throw new Error('Root missing')

const baseName = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={baseName || undefined}>
      <ErpApp />
    </BrowserRouter>
  </StrictMode>,
)

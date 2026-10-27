import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErpApp } from './ErpApp.tsx'
import { applyChoice, readChoice, sessionAccount } from './theme.ts'
import './index.css'

applyChoice(readChoice(sessionAccount()))

const root = document.getElementById('root')
if (!root) throw new Error('Root missing')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ErpApp />
    </BrowserRouter>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import App from './App.tsx'
import { theme } from './theme'

// Import Mantine core styles – required for Mantine components
import '@mantine/core/styles.css';

// Import global styles
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </BrowserRouter>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { ContextMenuProvider } from './components/Common/ContextMenu'
import { PomodoroProvider } from './context/PomodoroContext'
import { RadioProvider } from './context/RadioContext'
import { ToastProvider } from './context/ToastContext'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppProvider>
            <ContextMenuProvider>
              <PomodoroProvider>
                <RadioProvider>
                  <App />
                </RadioProvider>
              </PomodoroProvider>
            </ContextMenuProvider>
          </AppProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

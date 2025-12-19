import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App'
import './index.css'

const el = document.getElementById('root')
if (el) {
    const root = createRoot(el)
    root.render(
        <ErrorBoundary>
            <BrowserRouter>
                <ThemeProvider>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </ThemeProvider>
            </BrowserRouter>
        </ErrorBoundary>
    )
}

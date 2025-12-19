import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

type ThemeMode = 'dark' | 'light'

type ThemeContextValue = {
    theme: ThemeMode
    setTheme: (theme: ThemeMode) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function applyThemeToDom(theme: ThemeMode) {
    const root = document.documentElement
    const isDark = theme === 'dark'
    root.classList.toggle('dark', isDark)
    root.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>('dark')

    useEffect(() => {
        const saved = (localStorage.getItem('theme') as ThemeMode | null) || 'dark'
        const initial: ThemeMode = saved === 'light' ? 'light' : 'dark'
        setThemeState(initial)
        applyThemeToDom(initial)
    }, [])

    const setTheme = (next: ThemeMode) => {
        setThemeState(next)
        localStorage.setItem('theme', next)
        applyThemeToDom(next)
    }

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
    return ctx
}

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

type ThemeMode = 'dark' | 'light'
export type AccentTheme = 'neo-blue' | 'neo-orange' | 'neo-black'

type ThemeContextValue = {
    theme: ThemeMode
    accentTheme: AccentTheme
    setTheme: (theme: ThemeMode) => void
    setAccentTheme: (accent: AccentTheme) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function applyThemeToDom(theme: ThemeMode, accentTheme: AccentTheme) {
    const root = document.documentElement
    const isDark = theme === 'dark'
    root.classList.toggle('dark', isDark)
    root.dataset.theme = theme
    root.dataset.accent = accentTheme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>('dark')
    const [accentTheme, setAccentThemeState] = useState<AccentTheme>('neo-blue')

    useEffect(() => {
        const saved = (localStorage.getItem('theme') as ThemeMode | null) || 'dark'
        const initial: ThemeMode = saved === 'light' ? 'light' : 'dark'
        const savedAccent = (localStorage.getItem('accentTheme') as AccentTheme | null) || 'neo-blue'
        const initialAccent: AccentTheme = ['neo-blue', 'neo-orange', 'neo-black'].includes(savedAccent)
            ? savedAccent
            : 'neo-blue'
        setThemeState(initial)
        setAccentThemeState(initialAccent)
        applyThemeToDom(initial, initialAccent)
    }, [])

    const setTheme = (next: ThemeMode) => {
        setThemeState(next)
        localStorage.setItem('theme', next)
        applyThemeToDom(next, accentTheme)
    }

    const setAccentTheme = (next: AccentTheme) => {
        setAccentThemeState(next)
        localStorage.setItem('accentTheme', next)
        applyThemeToDom(theme, next)
    }

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

    const value = useMemo(() => ({ theme, accentTheme, setTheme, setAccentTheme, toggleTheme }), [theme, accentTheme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
    return ctx
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, setToken } from '../lib/api'

interface User {
    id: string
    email: string
    name?: string
}

interface AuthContextType {
    user: User | null
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, name?: string) => Promise<void>
    logout: () => void
    loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')
        if (token && userData) {
            setToken(token)
            setUser(JSON.parse(userData))
        }
        setLoading(false)
    }, [])

    const login = async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setToken(data.token)
        setUser(data.user)
    }

    const register = async (email: string, password: string, name?: string) => {
        const { data } = await api.post('/auth/register', { email, password, name })
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setToken(data.token)
        setUser(data.user)
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}

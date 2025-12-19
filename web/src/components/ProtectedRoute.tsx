import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Loader from './Loader'
import { ReactNode } from 'react'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader size="lg" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

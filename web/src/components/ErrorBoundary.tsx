import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-neutral-900 rounded-lg p-8 border border-neutral-800">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="text-red-500" size={32} />
                            <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
                        </div>
                        <p className="text-neutral-400 mb-4">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full px-6 py-3 bg-gradient-to-r from-brand-yellow to-brand-orange text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

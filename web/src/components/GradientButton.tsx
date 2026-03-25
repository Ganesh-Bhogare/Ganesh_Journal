import { ReactNode } from 'react'

interface GradientButtonProps {
    children: ReactNode
    onClick?: (e?: any) => void
    className?: string
    variant?: 'primary' | 'secondary'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
}

export default function GradientButton({ children, onClick, className = '', variant = 'primary', type = 'button', disabled }: GradientButtonProps) {
    const gradients = {
        primary: 'from-brand to-brand-yellow',
        secondary: 'from-neutral-700 via-neutral-600 to-neutral-700'
    }

    const primaryStyle = variant === 'primary'
        ? { backgroundImage: 'linear-gradient(90deg, var(--accent-grad-start), var(--accent-grad-mid), var(--accent-grad-end))' }
        : undefined

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={primaryStyle}
            className={`px-6 py-3 rounded-lg bg-gradient-to-r ${gradients[variant]} text-white font-semibold shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        >
            {children}
        </button>
    )
}

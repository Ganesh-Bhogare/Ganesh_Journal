import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GradientButton from '../components/GradientButton'
import { Mail, Lock, User } from 'lucide-react'

export default function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { register } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await register(email, password, name)
            navigate('/')
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-black via-neutral-900 to-black">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, rotateX: -10 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                transition={{ duration: 0.6, type: 'spring' }}
                className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 max-w-md w-full shadow-2xl"
                style={{ transformStyle: 'preserve-3d' }}
            >
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-brand-yellow to-brand-orange bg-clip-text text-transparent">
                        Ganesh Journal
                    </h1>
                    <p className="text-neutral-400">Create your trading account</p>
                </motion.div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <label className="block text-sm font-medium mb-2">Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="John Doe"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="trader@example.com"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <label className="block text-sm font-medium mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full pl-10 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </motion.div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-sm text-center"
                        >
                            {error}
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <GradientButton
                            className="w-full"
                            onClick={handleSubmit}
                        >
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </GradientButton>
                    </motion.div>
                </form>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-center text-neutral-400 text-sm mt-6"
                >
                    Already have an account?{' '}
                    <Link to="/login" className="text-brand hover:underline">
                        Sign In
                    </Link>
                </motion.p>
            </motion.div>
        </div>
    )
}

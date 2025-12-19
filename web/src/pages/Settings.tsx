import { motion } from 'framer-motion'
import AnimatedCard from '../components/AnimatedCard'
import { useTheme } from '../contexts/ThemeContext'

export default function Settings() {
    const { theme, toggleTheme } = useTheme()

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-neutral-400">Customize your trading journal experience</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.1}>
                    <h3 className="text-lg font-semibold mb-4">Appearance</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-neutral-300">Theme</span>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={toggleTheme}
                                className="px-4 py-2 bg-neutral-200/70 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700"
                            >
                                {theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}
                            </motion.button>
                        </div>
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.2}>
                    <h3 className="text-lg font-semibold mb-4">Trading Preferences</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-neutral-300">Risk per Trade</span>
                            <input
                                type="number"
                                defaultValue="1"
                                className="w-24 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                            />
                        </div>
                    </div>
                </AnimatedCard>
            </div>
        </div>
    )
}

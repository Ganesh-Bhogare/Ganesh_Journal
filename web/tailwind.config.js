/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                brand: {
                    DEFAULT: '#f59e0b',
                    yellow: '#f59e0b',
                    orange: '#fb923c'
                }
            }
        }
    },
    plugins: []
}

import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4002/api')

export const api = axios.create({
    baseURL: API_URL,
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status
        const serverError = String(error?.response?.data?.error || '').toLowerCase()
        const shouldForceLogout =
            status === 401 ||
            serverError.includes('user not found for token') ||
            serverError.includes('user not found') ||
            serverError.includes('invalid token')

        if (shouldForceLogout) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            delete api.defaults.headers.common['Authorization']

            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        }

        return Promise.reject(error)
    }
)

export function setToken(token?: string) {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        return
    }
    delete api.defaults.headers.common['Authorization']
}

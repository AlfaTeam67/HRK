import axios from 'axios'
import { env } from '@/lib/env'

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export function setupAxiosInterceptors(
  getToken: () => string | null,
  onUnauthorized: () => void = () => {}
) {
  apiClient.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  apiClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 401) {
          onUnauthorized()
        }
      }
      return Promise.reject(error)
    }
  )
}

import axios from 'axios'
import { env } from '@/lib/env'

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

export function setupAxiosInterceptors(getToken: () => string | null) {
  apiClient.interceptors.request.use((config) => {
    const token = getToken()

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  })
}

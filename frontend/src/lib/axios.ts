import axios from 'axios'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'

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
        if (status === 403) {
          const detail = (error.response?.data as { detail?: unknown })?.detail
          let description = 'Nie masz uprawnień do tej operacji.'
          if (detail && typeof detail === 'object') {
            const msg = ((detail as { message?: string }).message ?? '').toLowerCase()
            if (msg.includes('no scope') || msg.includes('no access')) {
              description = 'Brak dostępu do tego zasobu. Skontaktuj się z administratorem.'
            } else if (msg.includes('insufficient role')) {
              description = 'Niewystarczające uprawnienia. Wymagana wyższa rola.'
            } else if (msg.includes('admin already exists') || msg.includes('bootstrap is locked')) {
              description = 'System ma już administratora. Użyj panelu Dostępy i role.'
            }
          }
          notify({ type: 'error', title: 'Brak uprawnień', description })
        }
      }
      return Promise.reject(error)
    }
  )
}

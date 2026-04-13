import { useCallback } from 'react'

import { loginDemo } from '@/features/auth/api'
import { useAppDispatch, useAppSelector } from '@/hooks/store'
import { setToken } from '@/store/slices/authSlice'

export function useAuth() {
  const token = useAppSelector((state) => state.auth.token)
  const dispatch = useAppDispatch()

  const login = useCallback(async (): Promise<void> => {
    try {
      const result = await loginDemo()
      dispatch(setToken(result.accessToken))
    } catch {
      dispatch(setToken(null))
      throw new Error('Login failed. Please try again.')
    }
  }, [dispatch])

  return { token, login }
}

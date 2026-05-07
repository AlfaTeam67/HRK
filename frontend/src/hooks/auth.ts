import { useMutation } from '@tanstack/react-query'
import { useDispatch } from 'react-redux'

import { apiClient } from '@/lib/axios'
import { type AuthUser, setRoles, setToken, setUser } from '@/store/slices/authSlice'
import type { User } from '@/types/models'

const AD_PROFILES: Record<string, Pick<AuthUser, 'displayName' | 'initials' | 'department'>> = {
  asia: {
    displayName: 'Joanna Kniema',
    initials: 'JK',
    department: 'Specjalista HR',
  },
  mateusz: {
    displayName: 'Mateusz Kowalski',
    initials: 'MK',
    department: 'Administrator IT',
  },
  tomek: {
    displayName: 'Tomasz Nowak',
    initials: 'TN',
    department: 'Handlowy',
  },
  kasia: {
    displayName: 'Katarzyna Nowakowska',
    initials: 'KN',
    department: 'Opiekun klienta',
  },
}

function buildAuthUser(apiUser: User, login: string): AuthUser {
  const profile = AD_PROFILES[login.toLowerCase()] ?? {
    displayName: login,
    initials: login.slice(0, 2).toUpperCase(),
    department: 'HRK',
  }
  return { id: String(apiUser.id), login, email: apiUser.email, roles: apiUser.roles ?? [], ...profile }
}

export function useLogin() {
  const dispatch = useDispatch()

  return useMutation({
    mutationFn: async (username: string) => {
      const { data } = await apiClient.post<User>(`/api/v1/auth/login/${username}`)
      return { apiUser: data, username }
    },
    onSuccess: ({ apiUser, username }) => {
      const user = buildAuthUser(apiUser, username)
      dispatch(setUser(user))
      dispatch(setToken(apiUser.login))
      dispatch(setRoles(user.roles))
    },
  })
}

export { AD_PROFILES }

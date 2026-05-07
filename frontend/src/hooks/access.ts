import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { AccessAssignments, User, UserCreate, UserRole, UserUpdate } from '@/types/models'

const BASE = '/api/v1'

export function useMyAccess() {
  return useQuery({
    queryKey: ['access', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<AccessAssignments>(`${BASE}/access/me`)
      return data
    },
  })
}

export function useBootstrapAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<AccessAssignments>(`${BASE}/access/bootstrap-first-admin`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['access'] })
    },
  })
}

export function useUserAccess(userId: string | undefined) {
  return useQuery({
    queryKey: ['access', 'users', userId],
    queryFn: async () => {
      const { data } = await apiClient.get<AccessAssignments>(`${BASE}/access/users/${userId}`)
      return data
    },
    enabled: !!userId,
  })
}

export function useUpdateUserRoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: UserRole[] }) => {
      const { data } = await apiClient.put<AccessAssignments>(
        `${BASE}/access/users/${userId}/roles`,
        { roles },
      )
      return data
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['access', 'users', userId] })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUserCompanies() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, ids }: { userId: string; ids: string[] }) => {
      const { data } = await apiClient.put<AccessAssignments>(
        `${BASE}/access/users/${userId}/companies`,
        { ids },
      )
      return data
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['access', 'users', userId] })
    },
  })
}

// ── Users CRUD ───────────────────────────────────────────────────────────────

export interface UsersFilters {
  page?: number
  page_size?: number
}

export interface PaginatedUsers {
  items: User[]
  total: number
  page: number
  page_size: number
  pages: number
}

export function useUsers(filters?: UsersFilters) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedUsers>(`${BASE}/users/`, { params: filters })
      return data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UserCreate) => {
      const { data } = await apiClient.post<User>(`${BASE}/users/`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UserUpdate }) => {
      const { data } = await apiClient.patch<User>(`${BASE}/users/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/users/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

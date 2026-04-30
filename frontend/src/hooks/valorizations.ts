import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Valorization, ValorizationCreate, ValorizationStatus, ValorizationUpdate } from '@/types/models'

const BASE = '/api/v1'

export interface ValorizationsFilters {
  contract_id?: string
  year?: number
  status?: ValorizationStatus
}

export function useValorizations(filters?: ValorizationsFilters) {
  return useQuery({
    queryKey: ['valorizations', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Valorization[]>(`${BASE}/valorizations`, {
        params: filters,
      })
      return data
    },
  })
}

export function useCreateValorization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ValorizationCreate) => {
      const { data } = await apiClient.post<Valorization>(`${BASE}/valorizations`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['valorizations'] })
    },
  })
}

export function useUpdateValorization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ValorizationUpdate }) => {
      const { data } = await apiClient.patch<Valorization>(`${BASE}/valorizations/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['valorizations'] })
    },
  })
}

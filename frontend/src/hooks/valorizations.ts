import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type {
  IndexType,
  Valorization,
  ValorizationCreate,
  ValorizationStatus,
  ValorizationUpdate,
} from '@/types/models'

const BASE = '/api/v1'

export interface ValorizationsFilters {
  contract_id?: string
  year?: number
  status?: ValorizationStatus
}

export interface ValorizationAutoItem {
  contract_id: string
  index_type?: IndexType
  index_value?: number | null
}

export interface ValorizationAutoRequest {
  planned_date: string
  items: ValorizationAutoItem[]
}

export interface ValorizationAutoSkipped {
  contract_id: string
  reason: string
}

export interface ValorizationAutoResponse {
  planned_date: string
  year: number
  gus_value?: number | null
  created: Valorization[]
  skipped: ValorizationAutoSkipped[]
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

export function useDeleteValorization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/valorizations/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['valorizations'] })
    },
  })
}

export function useGenerateValorizations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ValorizationAutoRequest) => {
      const { data } = await apiClient.post<ValorizationAutoResponse>(
        `${BASE}/valorizations/auto`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['valorizations'] })
    },
  })
}

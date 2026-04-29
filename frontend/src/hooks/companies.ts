import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Company, CompanyCreate, CompanyUpdate, PaginatedResponse } from '@/types/models'

const BASE = '/api/v1'

export interface CompaniesFilters {
  page?: number
  page_size?: number
}

export function useCompanies(filters?: CompaniesFilters) {
  return useQuery({
    queryKey: ['companies', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Company>>(`${BASE}/companies`, {
        params: filters,
      })
      return data
    },
  })
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: ['companies', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Company>(`${BASE}/companies/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CompanyCreate) => {
      const { data } = await apiClient.post<Company>(`${BASE}/companies`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CompanyUpdate }) => {
      const { data } = await apiClient.patch<Company>(`${BASE}/companies/${id}`, payload)
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['companies', id] })
    },
  })
}

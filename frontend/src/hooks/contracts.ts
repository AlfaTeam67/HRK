import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Contract, ContractCreate, ContractStatus, ContractUpdate } from '@/types/models'

const BASE = '/api/v1'

export interface ContractsFilters {
  company_id?: string
  customer_id?: string
  statuses?: ContractStatus[]
  start_from?: string
  start_to?: string
  end_from?: string
  end_to?: string
}

export function useContracts(filters?: ContractsFilters) {
  return useQuery({
    queryKey: ['contracts', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Contract[]>(`${BASE}/contracts`, { params: filters })
      return data
    },
  })
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Contract>(`${BASE}/contracts/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ContractCreate) => {
      const { data } = await apiClient.post<Contract>(`${BASE}/contracts`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}

export function useUpdateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ContractUpdate }) => {
      const { data } = await apiClient.patch<Contract>(`${BASE}/contracts/${id}`, payload)
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contracts', id] })
    },
  })
}

export function useDeleteContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/contracts/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}

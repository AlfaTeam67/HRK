import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { Customer, CustomerCreate, CustomerStatus, CustomerUpdate } from '@/types/models'

const BASE = '/api/v1'

export interface CustomersFilters {
  q?: string
  company_id?: string
  statuses?: CustomerStatus[]
  created_from?: string
  created_to?: string
}

export function useCustomers(filters?: CustomersFilters) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer[]>(`${BASE}/customers`, { params: filters })
      return data
    },
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer>(`${BASE}/customers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CustomerCreate) => {
      const { data } = await apiClient.post<Customer>(`${BASE}/customers`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CustomerUpdate }) => {
      const { data } = await apiClient.patch<Customer>(`${BASE}/customers/${id}`, payload)
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customers', id] })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/customers/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

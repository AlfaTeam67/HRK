/**
 * React Query hooks for the price list template API (/api/v1/price-list).
 *
 * Types are defined inline because the generated api.ts has not been
 * regenerated yet. Run `npm run types:sync` after backend deployment to
 * replace these with proper generated types.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'

const BASE = '/api/v1/price-list'

export interface PriceListEntry {
  id: string
  service_id: string
  list_price: string   // Decimal comes as string from JSON
  description: string | null
  label: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PriceListCreate {
  service_id: string
  list_price: number
  description?: string | null
  label?: string | null
  is_active?: boolean
}

export interface PriceListUpdate {
  list_price?: number
  description?: string | null
  label?: string | null
  is_active?: boolean
}

export function usePriceList(activeOnly = false) {
  return useQuery({
    queryKey: ['price-list', activeOnly],
    queryFn: async () => {
      const { data } = await apiClient.get<PriceListEntry[]>(BASE, {
        params: { active_only: activeOnly, limit: 500 },
      })
      return data
    },
  })
}

export function useCreatePriceListEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PriceListCreate) => {
      const { data } = await apiClient.post<PriceListEntry>(BASE, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-list'] }),
  })
}

export function useUpdatePriceListEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & PriceListUpdate) => {
      const { data } = await apiClient.patch<PriceListEntry>(`${BASE}/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-list'] }),
  })
}

export function useDeletePriceListEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${BASE}/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-list'] }),
  })
}

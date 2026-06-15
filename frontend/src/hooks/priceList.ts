/**
 * React Query hooks for the price list template API (/api/v1/price-list).
 *
 * Types are defined inline because the generated api.ts has not been
 * regenerated yet. Run `npm run types:sync` after backend deployment to
 * replace these with proper generated types.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import { MOCK_SERVICES } from '@/features/contractGeneration/types'

const BASE = '/api/v1/price-list'

export interface PriceListEntry {
  id: string
  service_id: string
  service_name?: string  // present only in mocked data
  list_price: string   // Decimal comes as string from JSON
  description: string | null
  label: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Mocked price list entries derived from the contract generator services
 * (MOCK_SERVICES). Mirrors the data shown in the "Generator umów" wizard so
 * the base price list stays in sync with the generator demo data.
 */
const MOCK_NOW = '2026-01-01T00:00:00Z'
const MOCK_PRICE_LIST: PriceListEntry[] = MOCK_SERVICES.map((svc, i) => ({
  id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
  service_id: `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`,
  service_name: svc.name,
  list_price: svc.basePrice.toFixed(2),
  description: 'Stawka miesięczna (PLN/mc)',
  label: 'Standard',
  is_active: true,
  created_at: MOCK_NOW,
  updated_at: MOCK_NOW,
}))

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
      // Mocked: return the same services as the contract generator wizard.
      const entries = activeOnly ? MOCK_PRICE_LIST.filter(e => e.is_active) : MOCK_PRICE_LIST
      return Promise.resolve(entries)
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

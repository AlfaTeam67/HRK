import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import type { components } from '@/types/api'

type S = components['schemas']
export type ActivityLog = S['ActivityLogRead']
export type ActivityLogCreate = S['ActivityLogCreate']

const BASE = '/api/v1/activity-log'

export interface ActivityFilters {
  customer_id?: string
  contract_id?: string
  limit?: number
  offset?: number
}

export function useActivities(filters: ActivityFilters) {
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<ActivityLog[]>(BASE, { params: filters })
      return data
    },
    enabled: !!(filters.customer_id || filters.contract_id),
  })
}

export function useCreateActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ActivityLogCreate) => {
      const { data } = await apiClient.post<ActivityLog>(BASE, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
  })
}

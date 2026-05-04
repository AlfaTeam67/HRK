import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
export interface TimelineEvent {
  id: string
  timestamp: string
  event_type: string
  title: string
  detail?: string | null
  author?: string | null
  contract_id?: string | null
  valorization_id?: string | null
  metadata?: Record<string, unknown> | null
}

export interface TimelineFilters {
  customerId?: string
  from_date?: string
  to_date?: string
  event_types?: string[]
}

export function useCustomerTimeline(filters: TimelineFilters) {
  return useQuery({
    queryKey: ['customer-timeline', filters],
    queryFn: async () => {
      if (!filters.customerId) return [] as TimelineEvent[]
      const { customerId, ...params } = filters
      const { data } = await apiClient.get<TimelineEvent[]>(
        `/api/v1/customers/${customerId}/timeline`,
        { params },
      )
      return data
    },
    enabled: !!filters.customerId,
  })
}

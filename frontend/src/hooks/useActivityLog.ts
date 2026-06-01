import { useQuery } from '@tanstack/react-query'
import { useAppSelector } from '@/hooks/store'
import { apiClient } from '@/lib/axios'
import type { components } from '@/types/api'

export type ActivityType = components['schemas']['ActivityType']

export interface ActivityKPI {
  events_count: number
  meetings_count: number
  documents_count: number
  notes_count: number
}

export interface ActivityLogReportItem {
  id: string
  customer_id: string | null
  contract_id: string | null
  activity_type: ActivityType
  description: string
  performed_by: string | null
  performed_by_login: string | null
  activity_date: string
  additional_data: Record<string, unknown>
  is_own: boolean
}

export interface ActivityLogReportResponse {
  items: ActivityLogReportItem[]
  kpi: ActivityKPI
  total: number
}

export type ActivityReportPeriod = 7 | 30 | 90 | 180 | 365

export interface ActivityReportFilters {
  period?: ActivityReportPeriod
  user_id?: string
  customer_id?: string
  activity_type?: string
  limit?: number
  offset?: number
}

export function useActivityLog(filters: ActivityReportFilters = {}) {
  const user = useAppSelector((s) => s.auth.user)

  return useQuery({
    queryKey: ['reports', 'activity', user?.id, filters],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        current_user_id: user!.id,
        period: filters.period ?? 30,
        limit: filters.limit ?? 50,
        offset: filters.offset ?? 0,
      }
      if (filters.user_id) params.user_id = filters.user_id
      if (filters.customer_id) params.customer_id = filters.customer_id
      if (filters.activity_type) params.activity_type = filters.activity_type

      const { data } = await apiClient.get<ActivityLogReportResponse>(
        '/api/v1/reports/activity',
        { params },
      )
      return data
    },
    enabled: !!user?.id,
  })
}

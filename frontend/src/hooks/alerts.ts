import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'
import type { AlertRead, DashboardKpi } from '@/types/models'

const BASE = '/api/v1'

export function useAlerts(accountManagerId?: string) {
  return useQuery({
    queryKey: ['alerts', accountManagerId],
    queryFn: async () => {
      const { data } = await apiClient.get<AlertRead[]>(`${BASE}/alerts`, {
        params: { account_manager_id: accountManagerId }
      })
      return data
    },
  })
}

export function useDashboardKpi(accountManagerId?: string) {
  return useQuery({
    queryKey: ['dashboard-kpi', accountManagerId],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardKpi>(`${BASE}/dashboard/kpi`, {
        params: { account_manager_id: accountManagerId }
      })
      return data
    },
  })
}

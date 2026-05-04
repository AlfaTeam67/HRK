import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'

const BASE = '/api/v1'

export interface GusCpiResponse {
  value: number
  year: number
  quarter: number
  source: string
  fetched_at: string
}

export function useGusCpi() {
  return useQuery({
    queryKey: ['gus-cpi'],
    queryFn: async () => {
      const { data } = await apiClient.get<GusCpiResponse>(`${BASE}/gus/cpi`)
      return data
    },
  })
}

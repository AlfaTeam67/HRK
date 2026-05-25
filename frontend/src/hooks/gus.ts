import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/axios'

export interface GusCpiData {
  value: number
  year: number
  quarter: number
  source: string
  fetched_at: string
}

export function useGusCpi() {
  return useQuery<GusCpiData>({
    queryKey: ['gus-cpi'],
    queryFn: async () => {
      const { data } = await apiClient.get<GusCpiData>('/api/v1/gus/cpi')
      return data
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })
}

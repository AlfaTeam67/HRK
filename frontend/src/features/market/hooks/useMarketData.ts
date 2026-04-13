import { useQuery } from '@tanstack/react-query'

import { fetchMarketSnapshots } from '@/features/market/api'

export function useMarketData() {
  return useQuery({
    queryKey: ['market', 'snapshots'],
    queryFn: fetchMarketSnapshots,
    refetchInterval: 30_000,
  })
}

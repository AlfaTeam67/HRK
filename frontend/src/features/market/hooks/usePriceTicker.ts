import { useQuery } from '@tanstack/react-query'

import { fetchPriceTicker } from '@/features/market/api'

export function usePriceTicker() {
  return useQuery({
    queryKey: ['market', 'ticker'],
    queryFn: fetchPriceTicker,
    refetchInterval: 15_000,
  })
}

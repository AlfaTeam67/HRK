import { useQuery } from '@tanstack/react-query'

import { fetchPortfolio } from '@/features/portfolio/api'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio', 'overview'],
    queryFn: fetchPortfolio,
  })
}

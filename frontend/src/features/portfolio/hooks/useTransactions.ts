import { useQuery } from '@tanstack/react-query'

import { fetchTransactions } from '@/features/portfolio/api'

export function useTransactions() {
  return useQuery({
    queryKey: ['portfolio', 'transactions'],
    queryFn: fetchTransactions,
  })
}

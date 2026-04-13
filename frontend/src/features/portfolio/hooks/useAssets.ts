import { useMemo } from 'react'

import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio'

export function useAssets() {
  const portfolioQuery = usePortfolio()

  return useMemo(
    () => ({
      ...portfolioQuery,
      data: portfolioQuery.data?.assets ?? [],
    }),
    [portfolioQuery]
  )
}

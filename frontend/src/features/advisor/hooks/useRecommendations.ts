import { useQuery } from '@tanstack/react-query'

import { fetchRecommendations } from '@/features/advisor/api'

export function useRecommendations() {
  return useQuery({
    queryKey: ['advisor', 'recommendations'],
    queryFn: fetchRecommendations,
  })
}

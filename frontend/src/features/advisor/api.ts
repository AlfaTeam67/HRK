import type { Recommendation } from '@/types/advisor'

export async function fetchRecommendations(): Promise<Recommendation[]> {
  return [
    {
      id: 'rec-1',
      title: 'Rebalance tech exposure',
      confidence: '0.82',
      summary: 'Reduce concentration in large-cap tech by adding defensive ETF position.',
    },
    {
      id: 'rec-2',
      title: 'Set monthly DCA plan',
      confidence: '0.74',
      summary: 'Automate monthly recurring buy to smooth volatility in entry points.',
    },
  ]
}

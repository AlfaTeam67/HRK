import type { PriceSnapshot, PriceTicker } from '@/types/market'

export async function fetchMarketSnapshots(): Promise<PriceSnapshot[]> {
  return [
    { symbol: 'AAPL', currency: 'USD', price: '184.65', updatedAt: '2026-04-02T08:55:00.000Z' },
    { symbol: 'MSFT', currency: 'USD', price: '412.31', updatedAt: '2026-04-02T08:55:00.000Z' },
    { symbol: 'NVDA', currency: 'USD', price: '957.18', updatedAt: '2026-04-02T08:55:00.000Z' },
  ]
}

export async function fetchPriceTicker(): Promise<PriceTicker[]> {
  return [
    { symbol: 'AAPL', changePercent: '1.24', direction: 'UP' },
    { symbol: 'MSFT', changePercent: '-0.34', direction: 'DOWN' },
    { symbol: 'NVDA', changePercent: '2.48', direction: 'UP' },
  ]
}

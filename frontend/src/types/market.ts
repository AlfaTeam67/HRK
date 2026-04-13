export type SupportedSymbol = 'AAPL' | 'MSFT' | 'NVDA'

export interface PriceSnapshot {
  symbol: SupportedSymbol | string
  currency: string
  price: string
  updatedAt: string
}

export interface PriceTicker {
  symbol: SupportedSymbol | string
  changePercent: string
  direction: 'UP' | 'DOWN'
}

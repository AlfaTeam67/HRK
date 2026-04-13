export type MoneyValue = string

export interface Asset {
  id: string
  symbol: string
  quantity: string
  averagePrice: MoneyValue
  currentPrice: MoneyValue
}

export interface Portfolio {
  id: string
  ownerId: string
  currency: string
  totalValue: MoneyValue
  assets: Asset[]
}

export type TransactionType = 'BUY' | 'SELL'

export interface Transaction {
  id: string
  assetId: string
  type: TransactionType
  quantity: string
  price: MoneyValue
  executedAt: string
}

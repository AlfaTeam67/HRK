import type { Portfolio, Transaction } from '@/types/portfolio'

const portfolioMock: Portfolio = {
  id: 'portfolio-1',
  ownerId: 'user-1',
  currency: 'USD',
  totalValue: '19630.58',
  assets: [
    {
      id: 'asset-aapl',
      symbol: 'AAPL',
      quantity: '12.5',
      averagePrice: '168.42',
      currentPrice: '184.65',
    },
    {
      id: 'asset-msft',
      symbol: 'MSFT',
      quantity: '8',
      averagePrice: '389.21',
      currentPrice: '412.31',
    },
  ],
}

const transactionsMock: Transaction[] = [
  {
    id: 'txn-1',
    assetId: 'asset-aapl',
    type: 'BUY',
    quantity: '2',
    price: '181.01',
    executedAt: '2026-04-01T10:00:00.000Z',
  },
]

export async function fetchPortfolio(): Promise<Portfolio> {
  return portfolioMock
}

export async function fetchTransactions(): Promise<Transaction[]> {
  return transactionsMock
}

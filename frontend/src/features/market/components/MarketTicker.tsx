import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePriceTicker } from '@/features/market/hooks/usePriceTicker'

export function MarketTicker() {
  const { data, isLoading } = usePriceTicker()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market ticker</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p>Loading market data...</p>}
        <ul className="space-y-2">
          {data?.map((item) => (
            <li
              key={item.symbol}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="font-medium">{item.symbol}</span>
              <span className={item.direction === 'UP' ? 'text-emerald-600' : 'text-red-600'}>
                {item.direction === 'UP' ? '+' : ''}
                {item.changePercent}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

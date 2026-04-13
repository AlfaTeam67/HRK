import Decimal from 'decimal.js'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePortfolio } from '@/features/portfolio/hooks/usePortfolio'
import { formatMoney } from '@/utils/formatMoney'

export function PortfolioOverview() {
  const { data, isLoading } = usePortfolio()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">Loading portfolio...</CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">No portfolio data.</CardContent>
      </Card>
    )
  }

  const computedTotal = data.assets
    .reduce(
      (sum, asset) => sum.plus(new Decimal(asset.quantity).mul(asset.currentPrice)),
      new Decimal(0)
    )
    .toString()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio overview</CardTitle>
        <CardDescription>Snapshot based on current mock market values.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Assets: {data.assets.length}</Badge>
          <Badge variant="secondary">Total: {formatMoney(computedTotal, data.currency)}</Badge>
        </div>
        <ul className="space-y-2">
          {data.assets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="font-medium">{asset.symbol}</span>
              <span className="text-sm text-muted-foreground">
                {asset.quantity} @ {formatMoney(asset.currentPrice, data.currency)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

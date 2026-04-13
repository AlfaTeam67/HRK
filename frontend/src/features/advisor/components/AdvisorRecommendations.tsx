import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useRecommendations } from '@/features/advisor/hooks/useRecommendations'

export function AdvisorRecommendations() {
  const { data, isLoading } = useRecommendations()

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p>Loading advisor insights...</p>}
        <ul className="space-y-3">
          {data?.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">Confidence: {item.confidence}</p>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <Textarea placeholder="Add your investment context for the advisor..." />
          <Button type="button">Request updated recommendation</Button>
        </div>
      </CardContent>
    </Card>
  )
}

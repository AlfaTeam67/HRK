import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const renewalAlerts = [
  { label: 'Umowy kończące się (30 dni)', value: 4, tone: 'default' as const },
  { label: 'Umowy kończące się (60 dni)', value: 9, tone: 'secondary' as const },
  { label: 'Umowy kończące się (90 dni)', value: 14, tone: 'outline' as const },
]

const todayQueue = [
  'Zweryfikować waloryzację klienta Empik',
  'Przygotować aneks dla umowy kończącej się za 30 dni',
  'Uzupełnić notatkę po spotkaniu z klientem X',
]

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard CRM</h1>
        <p className="text-sm text-muted-foreground">
          Podsumowanie operacyjne: umowy, waloryzacje i działania na dziś.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {renewalAlerts.map((item) => (
          <Card key={item.label} size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-semibold">{item.value}</span>
                <Badge variant={item.tone}>Alert</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Co dzisiaj zrobić?</CardTitle>
            <CardDescription>
              Priorytety generowane z alertów umów i waloryzacji.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {todayQueue.map((item) => (
                <li key={item} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Smart Pulse</CardTitle>
            <CardDescription>Prognoza relacji z klientami na bazie notatek.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              <span>Empik</span>
              <Badge>Wymaga uwagi</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              <span>TechNova</span>
              <Badge variant="secondary">Dobra</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              <span>MediCare</span>
              <Badge variant="outline">Ryzyko utraty</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

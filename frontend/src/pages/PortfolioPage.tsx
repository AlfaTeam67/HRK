import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Karta klienta</h1>
        <p className="text-sm text-muted-foreground">
          Profil 360: dane firmy, opiekunowie, historia współpracy i status umów.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Empik Sp. z o.o.</CardTitle>
            <CardDescription>NIP: 123-456-78-90 · Okres płatności: 30 dni</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                <p className="font-medium">Opiekun</p>
                <p className="text-muted-foreground">Anna Kowalska</p>
              </div>
              <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                <p className="font-medium">Właściciel klienta</p>
                <p className="text-muted-foreground">Marek Nowak</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">
              <p className="mb-1 font-medium">Szybkie podsumowanie AI</p>
              <p className="text-muted-foreground">
                Klient strategiczny. Najbliższy termin: odnowienie umowy za 27 dni, waloryzacja
                wymaga decyzji po aktualizacji wskaźnika inflacji.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statusy</CardTitle>
            <CardDescription>Widok operacyjny dla zespołu CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Status klienta</span>
              <Badge variant="secondary">Aktywny</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Waloryzacja</span>
              <Badge>Do zrobienia</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Audyt zmian</span>
              <Badge variant="outline">Włączony</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

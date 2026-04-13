import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const roles = [
  { scope: 'Klient: Empik', role: 'Opiekun klienta', access: 'Odczyt + edycja umów' },
  { scope: 'Umowa: HRK/EMP/2024/07', role: 'Prawnik', access: 'Aneksy + akceptacje' },
  { scope: 'Klient: TechNova', role: 'Analityk', access: 'Odczyt waloryzacji' },
]

const auditEvents = [
  '12:45 · Anna Kowalska zmieniła status umowy na „Do odnowienia”',
  '11:10 · Marek Nowak zatwierdził waloryzację +5,2%',
  '09:32 · System wygenerował alert 30 dni dla HRK/EMP/2024/07',
]

export function AuthPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dostęp i autoryzacja</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Logowanie i role</CardTitle>
            <CardDescription>
              Dostęp do HRK CRM przez konto AD (SSO) z uprawnieniami per klient i per umowa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <span>SSO / LDAP</span>
              <Badge variant="secondary">Włączone</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <span>Role per klient i per umowa</span>
              <Badge>Wymagane</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <span>Log audytowy zmian</span>
              <Badge variant="outline">MVP</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Przykładowe uprawnienia</CardTitle>
            <CardDescription>Widok demo do walidacji modelu bezpieczeństwa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {roles.map((item) => (
              <div key={item.scope + item.role} className="rounded-lg border border-border/70 px-3 py-2">
                <p className="font-medium">{item.scope}</p>
                <p className="text-muted-foreground">{item.role}</p>
                <p className="text-muted-foreground">{item.access}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ślad audytowy (ostatnie zdarzenia)</CardTitle>
          <CardDescription>Zmiany statusów i decyzje akceptacyjne są rejestrowane.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {auditEvents.map((item) => (
              <li key={item} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

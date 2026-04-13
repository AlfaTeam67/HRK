import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AuthPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dostęp i autoryzacja</h1>

      <Card>
        <CardHeader>
          <CardTitle>Active Directory (intranet)</CardTitle>
          <CardDescription>
            Dostęp do systemu HRK CRM odbywa się przez konto AD bez klasycznej rejestracji.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <span>SSO / LDAP</span>
            <Badge variant="secondary">Do doprecyzowania</Badge>
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
    </div>
  )
}

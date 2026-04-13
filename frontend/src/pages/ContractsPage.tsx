import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type BadgeTone = 'default' | 'secondary' | 'outline'

const kpiCards: Array<{ label: string; value: number; hint: string; tone: BadgeTone }> = [
  { label: 'Kończą się w 30 dni', value: 3, hint: 'Wysoki priorytet', tone: 'default' },
  { label: 'Kończą się w 60 dni', value: 7, hint: 'Przygotuj ofertę', tone: 'secondary' },
  { label: 'Kończą się w 90 dni', value: 12, hint: 'Wczesny kontakt', tone: 'outline' },
  { label: 'Waloryzacje przeterminowane', value: 2, hint: 'Wymagana eskalacja', tone: 'default' },
]

const renewalPipeline = [
  { stage: 'Identyfikacja ryzyka', count: 5, value: '1,1 mln PLN' },
  { stage: 'Analiza i propozycja', count: 8, value: '2,4 mln PLN' },
  { stage: 'Negocjacje', count: 4, value: '1,8 mln PLN' },
  { stage: 'Akceptacja klienta', count: 3, value: '0,9 mln PLN' },
]

const contracts = [
  {
    client: 'Empik Sp. z o.o.',
    contract: 'HRK/EMP/2024/07',
    status: 'Do odnowienia',
    endDate: '2026-05-12',
    noticeWindow: '30 dni',
    owner: 'Anna Kowalska',
    tone: 'default' as BadgeTone,
  },
  {
    client: 'TechNova S.A.',
    contract: 'HRK/TN/2025/03',
    status: 'Aktywna',
    endDate: '2026-06-18',
    noticeWindow: '60 dni',
    owner: 'Marek Nowak',
    tone: 'secondary' as BadgeTone,
  },
  {
    client: 'MediCare Group',
    contract: 'HRK/MC/2023/11',
    status: 'Wypowiedzenie',
    endDate: '2026-05-02',
    noticeWindow: '30 dni',
    owner: 'Karolina Lis',
    tone: 'outline' as BadgeTone,
  },
  {
    client: 'Retail One',
    contract: 'HRK/RO/2024/09',
    status: 'Aktywna',
    endDate: '2026-08-20',
    noticeWindow: '90 dni',
    owner: 'Anna Kowalska',
    tone: 'secondary' as BadgeTone,
  },
]

const valorizationRules = [
  {
    contract: 'HRK/EMP/2024/07',
    index: 'CPI GUS',
    threshold: 'min. 4%',
    effectiveDate: '2026-06-01',
    lastChange: '+5,2% (2025-06-01)',
  },
  {
    contract: 'HRK/TN/2025/03',
    index: 'CPI GUS',
    threshold: 'min. 3%',
    effectiveDate: '2026-07-01',
    lastChange: '+3,4% (2025-07-01)',
  },
  {
    contract: 'HRK/MC/2023/11',
    index: 'CPI + koszyk branżowy',
    threshold: 'min. 5%',
    effectiveDate: '2026-05-15',
    lastChange: '+0,0% (brak akceptacji)',
  },
]

const escalationQueue = [
  {
    priority: 'Pilne',
    title: 'Empik: brak decyzji o waloryzacji',
    detail: 'Termin aneksu mija za 4 dni. Wymagany akcept dyrektora sprzedaży.',
  },
  {
    priority: 'Wysoki',
    title: 'MediCare: ryzyko wypowiedzenia',
    detail: 'Klient zgłosił zastrzeżenia do stawek. Zaplanować call zarządczy.',
  },
  {
    priority: 'Średni',
    title: 'TechNova: potwierdzić okno wypowiedzenia',
    detail: 'W dokumentacji występują dwie wersje SLA, wymagana korekta w CRM.',
  },
]

export function ContractsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Umowy i waloryzacja</h1>
        <p className="text-sm text-muted-foreground">
          Widok demonstracyjny cyklu życia umowy, alertów 90/60/30 i historii zmian stawek.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((item) => (
          <Card key={item.label} size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold">{item.value}</div>
              <Badge variant={item.tone}>{item.hint}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline odnowień</CardTitle>
            <CardDescription>Lejek szans na utrzymanie kontraktów.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {renewalPipeline.map((item) => (
              <div key={item.stage} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                <p className="font-medium">{item.stage}</p>
                <p className="text-muted-foreground">{item.count} umów · {item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kolejka eskalacji</CardTitle>
            <CardDescription>Alerty wymagające decyzji menedżerskiej.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {escalationQueue.map((item) => (
              <div key={item.title} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge variant={item.priority === 'Pilne' ? 'default' : item.priority === 'Wysoki' ? 'secondary' : 'outline'}>
                    {item.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lista umów</CardTitle>
            <CardDescription>Status, termin i okno wypowiedzenia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-[1.2fr_1fr_auto] gap-2 px-3 text-xs font-medium uppercase text-muted-foreground">
              <span>Klient / umowa</span>
              <span>Termin końca</span>
              <span>Status</span>
            </div>
            {contracts.map((item) => (
              <div
                key={item.contract}
                className="grid grid-cols-[1.2fr_1fr_auto] items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{item.client}</p>
                  <p className="text-xs text-muted-foreground">{item.contract} · opiekun: {item.owner}</p>
                </div>
                <div>
                  <p>{item.endDate}</p>
                  <p className="text-xs text-muted-foreground">Okno: {item.noticeWindow}</p>
                </div>
                <Badge variant={item.tone}>{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reguły i historia waloryzacji</CardTitle>
            <CardDescription>CPI/GUS, progi oraz data wejścia w życie.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {valorizationRules.map((rule) => (
              <div key={rule.contract} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{rule.contract}</p>
                  <Badge variant="outline">{rule.index}</Badge>
                </div>
                <p className="text-muted-foreground">Próg: {rule.threshold}</p>
                <p className="text-muted-foreground">Wejście: {rule.effectiveDate}</p>
                <p className="text-muted-foreground">Ostatnia zmiana: {rule.lastChange}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

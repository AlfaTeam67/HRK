import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/clients', label: 'Karta klienta' },
  { to: '/contracts', label: 'Umowy i waloryzacja' },
  { to: '/assistant', label: 'Asystent AI' },
  { to: '/access', label: 'Dostęp AD' },
]

export function AppSidebar() {
  return (
    <aside className="border-r border-border/80 px-4 py-6">
      <nav className="flex flex-col gap-2">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-muted text-foreground'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

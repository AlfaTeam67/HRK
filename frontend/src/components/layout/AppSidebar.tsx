import { useDispatch } from 'react-redux'
import { NavLink, useNavigate } from 'react-router-dom'

import { HrkLogo } from '@/components/HrkLogo'
import { useAppSelector } from '@/hooks/store'
import { logout } from '@/store/slices/authSlice'

/* ─── SVG icon helpers ───────────────────────────────────────── */
const IcoDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IcoClients = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IcoContracts = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const IcoValorization = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IcoAI = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IcoSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3"/>
  </svg>
)
const IcoReports = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const NAV_MAIN = [
  { to: '/',                   label: 'Pulpit główny', icon: IcoDashboard,    badge: 0,  end: true  },
  { to: '/managed-dashboard',  label: 'Mój pulpit',    icon: IcoDashboard,    badge: 0,  end: false },
  { to: '/clients',            label: 'Klienci',       icon: IcoClients,      badge: 19, end: false },
  { to: '/contracts',          label: 'Umowy',         icon: IcoContracts,    badge: 0,  end: false },
  { to: '/valorization',       label: 'Waloryzacja',   icon: IcoValorization, badge: 0,  end: false },
]
const NAV_AI    = [{ to: '/assistant', label: 'Chat z asystentem', icon: IcoAI,      end: false }]
const NAV_ADMIN = [
  { to: '/access',  label: 'Dostępy i role', icon: IcoSettings, end: false },
  { to: '/reports', label: 'Raporty',        icon: IcoReports,  end: false },
]

function NavItem({ to, label, icon: Icon, badge = 0, end = false }: {
  to: string; label: string; icon: React.ComponentType; badge?: number; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 6,
        fontSize: 13, fontWeight: 500,
        color: isActive ? '#e85c04' : '#9e9389',
        background: isActive ? 'rgba(232,92,4,0.13)' : 'transparent',
        textDecoration: 'none', marginBottom: 1,
        transition: 'color 0.12s, background 0.12s',
      })}
    >
      <Icon />
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{
          background: '#e85c04', color: 'white',
          fontSize: 10, fontWeight: 800,
          padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      )}
    </NavLink>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#4a4340',
      padding: '0 10px', marginBottom: 3, marginTop: 18,
    }}>{children}</div>
  )
}

export function AppSidebar() {
  const user = useAppSelector((s) => s.auth.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  function handleLogout() {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  const filteredNavMain = NAV_MAIN.filter((item) => {
    if (item.to === '/') {
      return user?.department === 'Specjalista HR' || user?.department === 'Administrator IT'
    }
    if (item.to === '/managed-dashboard') {
      return user?.department === 'Opiekun klienta'
    }
    return true
  })

  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: '#211e1b',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0, flexShrink: 0,
    }}>
      {/* ── Logo ─────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <HrkLogo size={26} />
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          color: '#4a4340', marginTop: 6, textTransform: 'uppercase',
        }}>
          Payroll · System CRM
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────── */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {filteredNavMain.map((item) => <NavItem key={item.label} {...item} />)}

        <SectionLabel>Asystent AI</SectionLabel>
        {NAV_AI.map((item) => <NavItem key={item.label} {...item} />)}

        <SectionLabel>Administracja</SectionLabel>
        {NAV_ADMIN.map((item) => <NavItem key={item.label} {...item} />)}
      </nav>

      {/* ── User footer ──────────────────────────────── */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #e85c04 0%, #c94f02 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'white',
          }}>
            {user?.initials ?? '??'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#e2ddd8',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user?.displayName ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: '#4a4340' }}>
              {user?.department ?? 'HRK'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Wyloguj się"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4a4340', padding: 4, borderRadius: 4,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e85c04' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4a4340' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

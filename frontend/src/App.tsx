import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { useAppDispatch, useAppSelector } from '@/hooks/store'
import { useIsAdmin, ROLE_LABELS_PL } from '@/hooks/usePermission'
import { apiClient } from '@/lib/axios'
import { AdvisorPage } from '@/pages/AdvisorPage'
import { ClientsPageApi } from '@/pages/ClientsPage'
import { ContractsPage } from '@/pages/ContractsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { ManagerDashboardPage } from '@/pages/ManagerDashboardPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ValorizationPage } from '@/pages/ValorizationPage'

function RequireAuth() {
  const user = useAppSelector((s) => s.auth.user)
  const token = useAppSelector((s) => s.auth.token)
  if (!user || !token) return <Navigate to="/login" replace />
  return <Outlet />
}

function AccessDenied() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, gap: 12, textAlign: 'center', padding: 40,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: '#fff5f0', border: '1.5px solid #fdd5b8',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>
        🔒
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1714' }}>Brak dostępu</div>
      <div style={{ fontSize: 13, color: '#6b6b6b', maxWidth: 320, lineHeight: 1.6 }}>
        Ta sekcja jest dostępna wyłącznie dla{' '}
        <strong>{ROLE_LABELS_PL['admin']}</strong>.
        Skontaktuj się z administratorem systemu, jeśli potrzebujesz dostępu.
      </div>
    </div>
  )
}

function RequireAdmin() {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return <AccessDenied />
  return <Outlet />
}

function DashboardRedirect() {
  const user = useAppSelector((s) => s.auth.user)
  if (user?.department === 'Opiekun klienta') {
    return <Navigate to="/managed-dashboard" replace />
  }
  return <DashboardPage />
}

function App() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)

  useEffect(() => {
    if (!token) return
    apiClient.get('/api/v1/customers', { params: { limit: 1 } }).catch(() => {
      // Interceptor handles 401/403 logout; this catch prevents unhandled rejection
    })
  }, [token, dispatch])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardRedirect />} />
          <Route path="managed-dashboard" element={<ManagerDashboardPage />} />
          <Route path="clients" element={<ClientsPageApi />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="valorization" element={<ValorizationPage />} />
          <Route path="assistant" element={<AdvisorPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="access" element={<SettingsPage />} />
          </Route>
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AppLayout }       from '@/components/layout/AppLayout'
import { useAppSelector }  from '@/hooks/store'
import { AdvisorPage }     from '@/pages/AdvisorPage'
import { ClientsPage }     from '@/pages/ClientsPage'
import { ContractsPage }   from '@/pages/ContractsPage'
import { DashboardPage }   from '@/pages/DashboardPage'
import { LoginPage }       from '@/pages/LoginPage'
import { ReportsPage }     from '@/pages/ReportsPage'
import { SettingsPage }    from '@/pages/SettingsPage'
import { ValorizationPage } from '@/pages/ValorizationPage'

function RequireAuth() {
  const user = useAppSelector((s) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index               element={<DashboardPage />}    />
          <Route path="clients"      element={<ClientsPage />}      />
          <Route path="contracts"    element={<ContractsPage />}    />
          <Route path="valorization" element={<ValorizationPage />} />
          <Route path="assistant"    element={<AdvisorPage />}      />
          <Route path="access"       element={<SettingsPage />}     />
          <Route path="reports"      element={<ReportsPage />}      />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

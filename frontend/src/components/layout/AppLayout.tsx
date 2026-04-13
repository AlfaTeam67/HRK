import { Outlet } from 'react-router-dom'

import { AppFooter } from '@/components/layout/AppFooter'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="grid min-h-[calc(100vh-120px)] grid-cols-[220px_1fr]">
        <AppSidebar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <AppFooter />
    </div>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ClientDetailPage } from '@/pages/clients/ClientDetailPage'
import { NewClientPage } from '@/pages/clients/NewClientPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ContentPage } from '@/pages/ContentPage'
import { ContentDetailPage } from '@/pages/ContentDetailPage'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { ApprovalPortalPage } from '@/pages/ApprovalPortalPage'
import { ReportPublicPage } from '@/pages/ReportPublicPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ReportsPage } from '@/pages/ReportsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (token) return <Navigate to="/app/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/approval/:token" element={<ApprovalPortalPage />} />
        <Route path="/report/:token" element={<ReportPublicPage />} />

        {/* Protected app routes */}
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/new" element={<NewClientPage />} />
          <Route path="clients/:id/*" element={<ClientDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="content" element={<ContentPage view="list" />} />
          <Route path="content/calendar" element={<ContentPage view="calendar" />} />
          <Route path="content/week" element={<ContentPage view="week" />} />
          <Route path="content/board" element={<ContentPage view="board" />} />
          <Route path="content/:id" element={<ContentDetailPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings/*" element={<SettingsPage />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { Toaster } from '@/components/ui/Toaster'
import { lazyPage } from '@/lib/lazyPage'
import { Suspense } from 'react'
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialogHost'

// Route-level code splitting: Dashboard and Login stay in the main bundle (first screens); every
// other page is its own chunk, loaded when opened.
const ClientsPage = lazyPage(() => import('@/pages/clients/ClientsPage'), 'ClientsPage')
const ClientDetailPage = lazyPage(() => import('@/pages/clients/ClientDetailPage'), 'ClientDetailPage')
const NewClientPage = lazyPage(() => import('@/pages/clients/NewClientPage'), 'NewClientPage')
const ContentPage = lazyPage(() => import('@/pages/ContentPage'), 'ContentPage')
const ContentDetailPage = lazyPage(() => import('@/pages/ContentDetailPage'), 'ContentDetailPage')
const ApprovalsPage = lazyPage(() => import('@/pages/ApprovalsPage'), 'ApprovalsPage')
const ApprovalPortalPage = lazyPage(() => import('@/pages/ApprovalPortalPage'), 'ApprovalPortalPage')
const ReportPublicPage = lazyPage(() => import('@/pages/ReportPublicPage'), 'ReportPublicPage')
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage'), 'SettingsPage')
const SocialConnectionsPage = lazyPage(() => import('@/pages/SocialConnectionsPage'), 'SocialConnectionsPage')
const AdsPage = lazyPage(() => import('@/pages/AdsPage'), 'AdsPage')
const GooglePerformancePage = lazyPage(() => import('@/pages/GooglePerformancePage'), 'GooglePerformancePage')
const PerformancePage = lazyPage(() => import('@/pages/PerformancePage'), 'PerformancePage')
const AdPlatformPage = lazyPage(() => import('@/pages/AdPlatformPage'), 'AdPlatformPage')
const ReportsPage = lazyPage(() => import('@/pages/ReportsPage'), 'ReportsPage')
const RegisterPage = lazyPage(() => import('@/pages/auth/RegisterPage'), 'RegisterPage')

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
      <Suspense fallback={null}>
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
          <Route path="calendar" element={<Navigate to="/app/content/calendar" replace />} />
          <Route path="content" element={<ContentPage view="list" />} />
          <Route path="content/calendar" element={<ContentPage view="calendar" />} />
          <Route path="content/board" element={<ContentPage view="board" />} />
          <Route path="content/:id" element={<ContentDetailPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="social" element={<SocialConnectionsPage />} />
          <Route path="ads" element={<AdsPage />} />
          <Route path="google" element={<GooglePerformancePage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="tiktok-ads" element={<AdPlatformPage platform="tiktok" />} />
          <Route path="linkedin-ads" element={<AdPlatformPage platform="linkedin" />} />
          <Route path="settings/*" element={<SettingsPage />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Routes>
      </Suspense>

      <Toaster />
      <ConfirmDialogHost />
    </BrowserRouter>
  )
}

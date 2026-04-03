import { Route, Routes } from 'react-router-dom'
import { AdminRoute } from '../auth/AdminRoute'
import { AuthPortalPage } from '../auth/pages/AuthPortalPage'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AppShell } from '../layout/AppShell'
import { EmailPage } from '../features/email/EmailPage'
import { FilesPage } from '../features/files/FilesPage'
import { ForbiddenPage } from '../pages/ForbiddenPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { LandingPage } from '../pages/LandingPage'
import { MLInsightsPage } from '../features/ml'
import { NetworkPage } from '../features/network/NetworkPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { OverviewHomePage } from '../pages/OverviewHomePage'
import { ProcessesPage } from '../features/processes/ProcessesPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { SystemPage } from '../features/system/SystemPage'
import { USBPage } from '../features/usb/USBPage'
import { AdminHomePage } from '../pages/AdminHomePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/user" element={<AuthPortalPage portal="user" />} />
      <Route path="/admin/sign-in" element={<AuthPortalPage portal="admin" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/overview" element={<OverviewHomePage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/processes" element={<ProcessesPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/usb" element={<USBPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/ml" element={<MLInsightsPage />} />
          <Route path="/insights" element={<MLInsightsPage />} />
          <Route path="admin" element={<AdminRoute />}>
            <Route index element={<AdminHomePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

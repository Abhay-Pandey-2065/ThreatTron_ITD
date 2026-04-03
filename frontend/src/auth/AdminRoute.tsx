import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export function AdminRoute() {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

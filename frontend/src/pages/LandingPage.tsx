import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function LandingPage() {
  const { user } = useAuth()
  if (user) {
    return <Navigate to="/overview" replace />
  }

  return (
    <div className="tt-landing">
      <div className="tt-landing__inner">
        <h1 className="tt-landing__title">ThreatTron</h1>
        <p className="tt-landing__lead">
          Choose how you want to sign in. User and Administrator portals use separate accounts and
          sign-up flows.
        </p>
        <div className="tt-landing__cards">
          <Link className="tt-landing__card" to="/user">
            <span className="tt-landing__card-title">User</span>
            <span className="tt-landing__card-desc">Sign in or register as a standard user</span>
          </Link>
          <Link className="tt-landing__card tt-landing__card--accent" to="/admin/sign-in">
            <span className="tt-landing__card-title">Administrator</span>
            <span className="tt-landing__card-desc">Sign in or register as an administrator</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

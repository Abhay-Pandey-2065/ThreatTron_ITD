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
        <p className="tt-landing__lead">Security monitoring console for telemetry, alerts and investigations.</p>
        <div className="tt-landing__cards">
          <Link className="tt-landing__card tt-landing__card--accent" to="/admin/sign-in">
            <span className="tt-landing__card-title">Administrator sign in</span>
            <span className="tt-landing__card-desc">Sign in or create an administrator account</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

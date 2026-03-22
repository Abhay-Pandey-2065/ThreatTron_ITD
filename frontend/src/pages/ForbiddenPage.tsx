import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function ForbiddenPage() {
  const { user } = useAuth()

  return (
    <div className="tt-static">
      <div className="tt-static__card">
        <h1 className="tt-static__title">Access denied</h1>
        <p className="tt-static__text">
          This area is restricted to administrators. If you need access, contact an admin.
        </p>
        <p className="tt-static__actions">
          {user ? (
            <Link className="tt-link" to="/overview">
              Back to overview
            </Link>
          ) : (
            <Link className="tt-link" to="/user">
              Sign in
            </Link>
          )}
        </p>
      </div>
    </div>
  )
}

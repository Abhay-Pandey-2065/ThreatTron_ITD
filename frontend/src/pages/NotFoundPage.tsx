import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="tt-page">
      <h1 className="tt-page__title">Page not found</h1>
      <p className="tt-page__lead">
        <Link className="tt-link" to="/overview">
          Return to overview
        </Link>
      </p>
    </div>
  )
}

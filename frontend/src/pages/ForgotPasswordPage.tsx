import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const portal = params.get('portal') === 'admin' ? 'admin' : 'user'
  const backHref = portal === 'admin' ? '/admin/sign-in' : '/user'

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="tt-login">
      <div className="tt-login__card">
        <p className="tt-login__breadcrumb">
          <Link className="tt-link" to={backHref}>
            ← Back to sign in
          </Link>
        </p>
        <h1 className="tt-login__title">Forgot password</h1>
        <p className="tt-login__subtitle">
          {portal === 'admin' ? 'Administrator' : 'User'} portal — request a reset link when the
          backend supports it.
        </p>

        {submitted ? (
          <p className="tt-dash__muted" role="status">
            If an account exists for <strong>{email || 'that address'}</strong>, password reset
            instructions would be sent. This demo has no mailer yet; implement{' '}
            <code className="tt-inline-code">POST /auth/forgot-password</code> and connect this
            form.
          </p>
        ) : (
          <form className="tt-login__form" onSubmit={handleSubmit} noValidate>
            <label className="tt-field">
              <span className="tt-field__label">Email</span>
              <input
                className="tt-input"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button className="tt-button tt-button--primary" type="submit">
              Send reset link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

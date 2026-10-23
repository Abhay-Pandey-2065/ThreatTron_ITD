import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const portal = params.get('portal') === 'admin' ? 'admin' : 'user'
  const backHref = portal === 'admin' ? '/admin/sign-in' : '/user'

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setMessage('Use at least 8 characters.')
      return
    }
    setMessage(
      token
        ? 'Password reset is not available yet. Contact an administrator to reset your password.'
        : 'This reset link is incomplete. Request a new one from the forgot password page.',
    )
  }

  return (
    <div className="tt-login">
      <div className="tt-login__card">
        <p className="tt-login__breadcrumb">
          <Link className="tt-link" to={backHref}>
            Back to sign in
          </Link>
        </p>
        <h1 className="tt-login__title">Reset password</h1>
        <p className="tt-login__subtitle">Choose a new password for your account.</p>

        <form className="tt-login__form" onSubmit={handleSubmit} noValidate>
          <label className="tt-field">
            <span className="tt-field__label">New password</span>
            <input
              className="tt-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <label className="tt-field">
            <span className="tt-field__label">Confirm password</span>
            <input
              className="tt-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {message ? (
            <p className="tt-login__error" role="status">
              {message}
            </p>
          ) : null}
          <button className="tt-button tt-button--primary" type="submit">
            Update password
          </button>
        </form>
      </div>
    </div>
  )
}

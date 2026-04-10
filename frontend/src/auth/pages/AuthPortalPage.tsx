import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { AuthPortal } from '../types'
import { useAuth } from '../useAuth'

type AuthMode = 'signin' | 'signup'

const portalCopy: Record<
  AuthPortal,
  {
    title: string
    subtitle: string
    signInHeading: string
    signUpHeading: string
    demoTitle: string
    demoNote: string
  }
> = {
  user: {
    title: 'ThreatTron',
    subtitle: 'User console — sign in to access your account.',
    signInHeading: 'User sign in',
    signUpHeading: 'User sign up',
    demoTitle: 'User demo (any non-empty password)',
    demoNote:
      'Accounts are stored in this browser until the API is connected. Reserved demo emails cannot be used for sign-up.',
  },
  admin: {
    title: 'ThreatTron',
    subtitle: 'Administrator console — sign in or register an admin account.',
    signInHeading: 'Administrator sign in',
    signUpHeading: 'Administrator sign up',
    demoTitle: 'Administrator demo (any non-empty password)',
    demoNote:
      'Admin registrations are for local demo only. Connect a real backend before production use.',
  },
}

export function AuthPortalPage({ portal }: { portal: AuthPortal }) {
  const { user, login, signup, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string } | undefined
  let from = state?.from ?? '/overview'
  if (from === '/' || from === '/user' || from === '/admin/sign-in') from = '/overview'

  const copy = portalCopy[portal]
  const otherPortalHref = portal === 'user' ? '/admin/sign-in' : '/user'
  // const otherPortalLabel = portal === 'user' ? 'Administrator portal' : 'User portal'

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirm, setSignUpConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (user && user.role !== portal) {
    return <Navigate to={otherPortalHref} replace />
  }

  function goToSignIn() {
    setError(null)
    setMode('signin')
  }

  function goToSignUp() {
    if (portal !== 'admin') return
    setError(null)
    setMode('signup')
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await login(email, password, portal)
    setPending(false)
    if (result.ok) {
      navigate(from, { replace: true })
    } else {
      setError(result.message)
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    if (portal !== 'admin') return
    setError(null)
    if (signUpPassword !== signUpConfirm) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    const result = await signup(signUpEmail, signUpPassword, portal)
    setPending(false)
    if (result.ok) {
      navigate(from, { replace: true })
    } else {
      setError(result.message)
    }
  }

  if (user && user.role === portal) {
    return (
      <div className="tt-login">
        <div className="tt-login__card">
          <h1 className="tt-login__title">{copy.title}</h1>
          <p className="tt-login__subtitle">You are already signed in ({portal === 'admin' ? 'Administrator' : 'User'}).</p>

          <div className="tt-login__signed">
            <p className="tt-login__signed-email">{user.email}</p>
            <span className="tt-login__signed-role">
              {user.role === 'admin' ? 'Administrator' : 'User'}
            </span>
            <p className="tt-login__signed-hint">
              Continue to the console, or sign out to use a different account.
            </p>
            <div className="tt-login__signed-actions">
              <button
                type="button"
                className="tt-button tt-button--primary"
                onClick={() => navigate(from, { replace: true })}
              >
                Continue
              </button>
              <button
                type="button"
                className="tt-button tt-button--ghost"
                onClick={() => logout()}
              >
                Sign out
              </button>
            </div>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="tt-login">
      <div className="tt-login__card">
        <p className="tt-login__breadcrumb">
          <Link className="tt-link" to="/">
            ← Home
          </Link>
        </p>
        <h1 className="tt-login__title">{copy.title}</h1>
        <p className="tt-login__subtitle">{copy.subtitle}</p>

        {mode === 'signin' || portal !== 'admin' ? (
          <section className="tt-login__panel tt-login__panel--signin" aria-labelledby="signin-heading">
            <h2 id="signin-heading" className="tt-login__panel-title">
              {copy.signInHeading}
            </h2>
            <form className="tt-login__form" onSubmit={handleSignIn} noValidate>
              <label className="tt-field">
                <span className="tt-field__label">Email</span>
                <input
                  className="tt-input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="tt-field">
                <span className="tt-field__label">Password</span>
                <input
                  className="tt-input"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <p className="tt-login__forgot">
                <Link className="tt-link" to={`/forgot-password?portal=${portal}`}>
                  Forgot password?
                </Link>
                {' · '}
                <Link className="tt-link" to={`/reset-password?portal=${portal}`}>
                  Reset with token
                </Link>
              </p>
              {error ? (
                <p className="tt-login__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="tt-button tt-button--primary" type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            {portal === 'admin' && (
              <p className="tt-login__switch">
                Don&apos;t have an account?{' '}
                <button type="button" className="tt-link tt-link--button" onClick={goToSignUp}>
                  Sign up
                </button>
              </p>
            )}
          </section>
        ) : (
          <section className="tt-login__panel" aria-labelledby="signup-heading">
            <h2 id="signup-heading" className="tt-login__panel-title">
              {copy.signUpHeading}
            </h2>
            <form className="tt-login__form" onSubmit={handleSignUp} noValidate>
              <label className="tt-field">
                <span className="tt-field__label">Email</span>
                <input
                  className="tt-input"
                  type="email"
                  name="signup-email"
                  autoComplete="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                />
              </label>
              <label className="tt-field">
                <span className="tt-field__label">Password</span>
                <input
                  className="tt-input"
                  type="password"
                  name="signup-password"
                  autoComplete="new-password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <label className="tt-field">
                <span className="tt-field__label">Confirm password</span>
                <input
                  className="tt-input"
                  type="password"
                  name="signup-confirm"
                  autoComplete="new-password"
                  value={signUpConfirm}
                  onChange={(e) => setSignUpConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              {error ? (
                <p className="tt-login__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="tt-button tt-button--primary" type="submit" disabled={pending}>
                {pending ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <p className="tt-login__switch">
              Already have an account?{' '}
              <button type="button" className="tt-link tt-link--button" onClick={goToSignIn}>
                Sign in
              </button>
            </p>
          </section>
        )}

        <div className="tt-login__demo">
          <p className="tt-login__demo-title">{copy.demoTitle}</p>
          <ul>
            {portal === 'user' ? (
              <li>
                <code>user@threattron.local</code> — standard user
              </li>
            ) : (
              <li>
                <code>admin@threattron.local</code> — administrator
              </li>
            )}
          </ul>
          <p className="tt-login__note">{copy.demoNote}</p>
        </div>


      </div>
    </div>
  )
}

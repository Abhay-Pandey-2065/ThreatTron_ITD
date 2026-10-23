import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  if (!user) return null


  return (
    <div className="tt-user-menu" ref={ref}>
      <button
        type="button"
        className="tt-user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <span className="tt-user-menu__trigger-text">{user.email}</span>
      </button>
      {open ? (
        <div className="tt-user-menu__dropdown" role="menu">
          <div className="tt-user-menu__meta">
            <span className="tt-user-menu__role-pill">
              {user.role === 'admin' ? 'Administrator' : 'User'}
            </span>
          </div>
          {user.role === 'admin' ? (
            <NavLink
              className="tt-user-menu__item"
              to="/admin/sign-in"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Account
            </NavLink>
          ) : null}
          <NavLink
            className="tt-user-menu__item"
            to={`/forgot-password?portal=${user.role === 'admin' ? 'admin' : 'user'}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Forgot password
          </NavLink>
          <button
            type="button"
            className="tt-user-menu__item tt-user-menu__item--button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
              navigate('/', { replace: true })
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

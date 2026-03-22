import { createContext } from 'react'
import type { AuthPortal } from './types'
import type { AuthUser } from './types'

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string }

export type SignupResult = LoginResult

export interface AuthContextValue {
  user: AuthUser | null
  login: (
    email: string,
    password: string,
    portal: AuthPortal,
  ) => Promise<LoginResult>
  signup: (
    email: string,
    password: string,
    portal: AuthPortal,
  ) => Promise<SignupResult>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

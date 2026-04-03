export type Role = 'user' | 'admin'

export type AuthPortal = 'user' | 'admin'

export interface AuthUser {
  email: string
  role: Role
}

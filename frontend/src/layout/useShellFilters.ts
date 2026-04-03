import { useContext } from 'react'
import { ShellFiltersContext, type ShellFiltersState } from './shell-filters-context'

export function useShellFilters(): ShellFiltersState {
  const ctx = useContext(ShellFiltersContext)
  if (!ctx) {
    throw new Error('useShellFilters must be used within ShellFiltersProvider')
  }
  return ctx
}

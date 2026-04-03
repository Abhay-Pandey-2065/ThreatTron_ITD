import { createContext } from 'react'

export type TimeRangePreset = '1h' | '24h' | '7d' | 'custom'

export const SEARCH_PARAM_TIME = 'tr'
export const SEARCH_PARAM_AGENT = 'agent'

export interface ShellFiltersState {
  timeRange: TimeRangePreset
  setTimeRange: (v: TimeRangePreset) => void
  agentFilter: string
  setAgentFilter: (v: string) => void
  /** Build path with current filter params for shareable bookmarks */
  buildPath: (pathname: string) => string
}

export const ShellFiltersContext = createContext<ShellFiltersState | null>(null)

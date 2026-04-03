import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ShellFiltersContext,
  SEARCH_PARAM_AGENT,
  SEARCH_PARAM_TIME,
  type TimeRangePreset,
} from './shell-filters-context'

const VALID_TR: TimeRangePreset[] = ['1h', '24h', '7d', 'custom']

export function ShellFiltersProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const trParam = searchParams.get(SEARCH_PARAM_TIME)
  const agentParam = searchParams.get(SEARCH_PARAM_AGENT) ?? ''

  const [timeRange, setTimeRangeState] = useState<TimeRangePreset>(() =>
    trParam && VALID_TR.includes(trParam as TimeRangePreset) ? (trParam as TimeRangePreset) : '24h',
  )
  const [agentFilter, setAgentFilterState] = useState(() => agentParam)

  useEffect(() => {
    if (trParam && VALID_TR.includes(trParam as TimeRangePreset) && trParam !== timeRange) {
      setTimeRangeState(trParam as TimeRangePreset)
    }
  }, [trParam])

  useEffect(() => {
    setAgentFilterState(agentParam)
  }, [agentParam])

  const setTimeRange = useCallback(
    (v: TimeRangePreset) => {
      setTimeRangeState(v)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(SEARCH_PARAM_TIME, v)
          if (!agentFilter) next.delete(SEARCH_PARAM_AGENT)
          else next.set(SEARCH_PARAM_AGENT, agentFilter)
          return next
        },
        { replace: true },
      )
    },
    [agentFilter, setSearchParams],
  )

  const setAgentFilter = useCallback(
    (v: string) => {
      setAgentFilterState(v)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(SEARCH_PARAM_TIME, timeRange)
          if (v.trim()) next.set(SEARCH_PARAM_AGENT, v.trim())
          else next.delete(SEARCH_PARAM_AGENT)
          return next
        },
        { replace: true },
      )
    },
    [timeRange, setSearchParams],
  )

  const buildPath = useCallback(
    (pathname: string) => {
      const params = new URLSearchParams()
      params.set(SEARCH_PARAM_TIME, timeRange)
      if (agentFilter.trim()) params.set(SEARCH_PARAM_AGENT, agentFilter.trim())
      const q = params.toString()
      return q ? `${pathname}?${q}` : pathname
    },
    [timeRange, agentFilter],
  )

  const value = useMemo(
    () => ({
      timeRange,
      setTimeRange,
      agentFilter,
      setAgentFilter,
      buildPath,
    }),
    [timeRange, setTimeRange, agentFilter, setAgentFilter, buildPath],
  )

  return (
    <ShellFiltersContext.Provider value={value}>{children}</ShellFiltersContext.Provider>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { fetchMlSummary, type MlSummary } from '../../lib/api'
import type { EventsQuery } from '../../lib/api'

export type MlSummaryState =
  | { status: 'loading' }
  | { status: 'success'; data: MlSummary | null }
  | { status: 'error'; message: string }

export function useMlSummary(query: EventsQuery, options?: { refetchOnFocus?: boolean }) {
  const [state, setState] = useState<MlSummaryState>({ status: 'loading' })
  const refetch = useCallback(() => {
    setState({ status: 'loading' })
    fetchMlSummary(query)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) => setState({ status: 'error', message: err?.message ?? 'Failed to load' }))
  }, [query.time_range, query.agent_id])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!options?.refetchOnFocus) return
    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refetch, options?.refetchOnFocus])

  return { ...state, refetch }
}

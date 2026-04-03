import { useCallback, useEffect, useState } from 'react'
import { fetchMlInsights, type MlInsight } from '../../lib/api'
import type { EventsQuery } from '../../lib/api'

export type MlInsightsState =
  | { status: 'loading' }
  | { status: 'success'; data: MlInsight[] }
  | { status: 'error'; message: string }

export function useMlInsights(query: EventsQuery) {
  const [state, setState] = useState<MlInsightsState>({ status: 'loading' })
  const refetch = useCallback(() => {
    setState({ status: 'loading' })
    fetchMlInsights(query)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) => setState({ status: 'error', message: err?.message ?? 'Failed to load' }))
  }, [query.time_range, query.agent_id, query.limit, query.offset])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ...state, refetch }
}

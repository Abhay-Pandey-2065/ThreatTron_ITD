import { useMemo, useState, type ReactNode } from 'react'

interface TimestampedEvent {
  timestamp: string
}

interface EventFiltersProps<T extends TimestampedEvent> {
  events: T[]
  searchText: (event: T) => string
  matches?: (event: T) => boolean
  extraControls?: ReactNode
  children: (events: T[]) => ReactNode
}

export function EventFilters<T extends TimestampedEvent>({
  events,
  searchText,
  matches,
  extraControls,
  children,
}: EventFiltersProps<T>) {
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const from = fromDate ? new Date(fromDate).getTime() : null
    const to = toDate ? new Date(toDate).getTime() : null
    return events
      .filter((event) => {
        const timestamp = new Date(event.timestamp).getTime()
        return (!query || searchText(event).toLocaleLowerCase().includes(query))
          && (from == null || timestamp >= from)
          && (to == null || timestamp <= to)
          && (!matches || matches(event))
      })
      .sort((a, b) => {
        const delta = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        return sortOrder === 'newest' ? -delta : delta
      })
  }, [events, search, fromDate, toDate, sortOrder, searchText, matches])

  return (
    <>
      <div className="tt-event-filters" role="search" aria-label="Filter telemetry events">
        <label className="tt-filter">
          <span className="tt-filter__label">Search</span>
          <input className="tt-input tt-input--compact" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events" />
        </label>
        <label className="tt-filter">
          <span className="tt-filter__label">From date/time</span>
          <input className="tt-input tt-input--compact" type="datetime-local" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label className="tt-filter">
          <span className="tt-filter__label">To date/time</span>
          <input className="tt-input tt-input--compact" type="datetime-local" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <label className="tt-filter">
          <span className="tt-filter__label">Sort by time</span>
          <select className="tt-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}>
            <option value="newest">Latest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        {extraControls}
      </div>
      <p className="tt-dash__muted tt-event-filters__count">{filteredEvents.length} of {events.length} events</p>
      {children(filteredEvents)}
    </>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ShellFiltersProvider } from './ShellFiltersProvider'
import { useShellFilters } from './useShellFilters'
import type { TimeRangePreset } from './shell-filters-context'
import { UserMenu } from './UserMenu'

interface NavItem {
  to: string
  label: string
  abbr: string
  end?: boolean
}

interface NavSection {
  title: string | null
  items: NavItem[]
  adminOnly?: boolean
}

const NAV_SECTIONS: NavSection[] = [
  { title: null, items: [{ to: '/overview', label: 'Overview', abbr: 'OV', end: true }] },
  {
    title: 'Investigate',
    items: [
      { to: '/alerts', label: 'Alerts', abbr: 'AL' },
      { to: '/investigations', label: 'Investigations', abbr: 'IN' },
      { to: '/workflow-sandbox', label: 'Workflow Sandbox', abbr: 'WS' },
    ],
  },
  {
    title: 'Telemetry',
    items: [
      { to: '/files', label: 'Files', abbr: 'FI' },
      { to: '/processes', label: 'Processes', abbr: 'PR' },
      { to: '/system', label: 'System', abbr: 'SY' },
      { to: '/usb', label: 'USB', abbr: 'US' },
      { to: '/network', label: 'Network', abbr: 'NW' },
    ],
  },
  { title: 'Analytics', items: [{ to: '/ml', label: 'ML / Insights', abbr: 'ML' }] },
  { title: 'Admin', items: [{ to: '/admin', label: 'Admin', abbr: 'AD' }], adminOnly: true },
]

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

export function AppShell() {
  return (
    <ShellFiltersProvider>
      <AppShellLayout />
    </ShellFiltersProvider>
  )
}

function AppShellLayout() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { timeRange, setTimeRange, agentFilter, setAgentFilter, buildPath } = useShellFilters()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const online = useOnlineStatus()

  const navTo = (path: string) => buildPath(path)
  const visibleSections = NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin)

  const current = ALL_ITEMS.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  )
  const currentSection = NAV_SECTIONS.find((section) => section.items.includes(current as NavItem))
  const pageLabel = current?.label ?? 'Console'

  useEffect(() => {
    document.title = `${pageLabel} · ThreatTron`
  }, [pageLabel])

  return (
    <div
      className={`tt-shell tt-shell--with-sidebar ${sidebarCollapsed ? 'tt-shell--sidebar-collapsed' : ''}`}
    >
      <aside
        className="tt-shell__sidebar"
        aria-label="Main navigation"
        aria-expanded={!sidebarCollapsed}
      >
        <div className="tt-shell__sidebar-header">
          <NavLink to={navTo('/overview')} className="tt-shell__sidebar-logo" end>
            <span className="tt-brand-name">ThreatTron</span>
            <span className="tt-brand-mark" aria-hidden>
              TT
            </span>
          </NavLink>
          <button
            type="button"
            className="tt-shell__sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
        <nav className="tt-shell__sidebar-nav">
          {visibleSections.map((section) => (
            <div key={section.title ?? 'root'} className="tt-shell__sidebar-group">
              {section.title ? (
                <>
                  <div className="tt-sidenav-divider" aria-hidden />
                  <div className="tt-sidenav-section">{section.title}</div>
                </>
              ) : null}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={navTo(item.to)}
                  className={sideNavClass}
                  end={item.end}
                  title={item.label}
                >
                  <span className="tt-sidenav__abbr" aria-hidden>
                    {item.abbr}
                  </span>
                  <span className="tt-sidenav__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="tt-shell__column">
        <header className="tt-shell__topbar">
          <div className="tt-shell__topbar-left">
            <nav className="tt-breadcrumb" aria-label="Breadcrumb">
              <span>Console</span>
              {currentSection?.title ? (
                <>
                  <span className="tt-breadcrumb__sep" aria-hidden>
                    /
                  </span>
                  <span>{currentSection.title}</span>
                </>
              ) : null}
              <span className="tt-breadcrumb__sep" aria-hidden>
                /
              </span>
              <span className="tt-breadcrumb__current" aria-current="page">
                {pageLabel}
              </span>
            </nav>
            <div className="tt-shell__topbar-filters" role="search" aria-label="Global filters">
              <label className="tt-filter">
                <span className="tt-filter__label">Time range</span>
                <select
                  className="tt-select"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRangePreset)}
                >
                  <option value="1h">Last 1 hour</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="custom">Custom (set dates on page)</option>
                </select>
              </label>
              <label className="tt-filter">
                <span className="tt-filter__label">Agent</span>
                <input
                  className="tt-input tt-input--compact"
                  type="text"
                  placeholder="All agents"
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  aria-label="Filter by agent id"
                />
              </label>
            </div>
          </div>
          <div className="tt-topbar-status">
            <span className={`tt-status-dot ${online ? '' : 'tt-status-dot--offline'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
            <UtcClock />
          </div>
          <div className="tt-shell__topbar-user">
            <UserMenu />
          </div>
        </header>

        <main className="tt-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function UtcClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const iso = now.toISOString()
  return (
    <time className="tt-clock" dateTime={iso}>
      {iso.slice(11, 19)} UTC
    </time>
  )
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

function sideNavClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'tt-sidenav tt-sidenav--active' : 'tt-sidenav'
}

import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import packageJson from '../../package.json'
import { ShellFiltersProvider } from './ShellFiltersProvider'
import { useShellFilters } from './useShellFilters'
import type { TimeRangePreset } from './shell-filters-context'
import { UserMenu } from './UserMenu'

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

  const navTo = (path: string) => buildPath(path)

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
            ThreatTron
          </NavLink>
          <button
            type="button"
            className="tt-shell__sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? '☰' : '✕'}
          </button>
        </div>
        <nav className="tt-shell__sidebar-nav">
          <NavLink to={navTo('/overview')} className={sideNavClass} end>
            Overview
          </NavLink>
          <NavLink to={navTo('/files')} className={sideNavClass}>
            Files
          </NavLink>
          <NavLink to={navTo('/processes')} className={sideNavClass}>
            Processes
          </NavLink>
          <NavLink to={navTo('/system')} className={sideNavClass}>
            System
          </NavLink>
          <NavLink to={navTo('/email')} className={sideNavClass}>
            Email
          </NavLink>
          <NavLink to={navTo('/usb')} className={sideNavClass}>
            USB
          </NavLink>
          <NavLink to={navTo('/network')} className={sideNavClass}>
            Network
          </NavLink>
          <NavLink to={navTo('/ml')} className={sideNavClass}>
            ML / Insights
          </NavLink>
          {isAdmin ? (
            <NavLink to={navTo('/admin')} className={sideNavClass}>
              Admin
            </NavLink>
          ) : null}
        </nav>
      </aside>

      <div className="tt-shell__column">
        <header className="tt-shell__topbar">
          <div className="tt-shell__topbar-left">
            {sidebarCollapsed && (
              <button
                type="button"
                className="tt-shell__sidebar-toggle tt-shell__sidebar-toggle--topbar"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
              >
                ☰
              </button>
            )}
            <h2 className="tt-shell__topbar-title">ThreatTron</h2>
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
                  <option value="custom">Custom (UI only)</option>
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
          <div className="tt-shell__topbar-user">
            <UserMenu />
          </div>
        </header>

        <main className="tt-shell__main">
          <Outlet />
        </main>

        <footer className="tt-shell__footer">
          <span className="tt-shell__footer-version">ThreatTron console v{packageJson.version}</span>
          <span className="tt-shell__footer-note">
            Telemetry metadata only — no payload capture. ML and event APIs not connected in this
            build.
          </span>
        </footer>
      </div>
    </div>
  )
}

function sideNavClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'tt-sidenav tt-sidenav--active' : 'tt-sidenav'
}

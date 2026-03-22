import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="tt-drawer-backdrop" onClick={onClose} aria-hidden>
      <aside
        className="tt-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tt-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tt-drawer__header">
          <h2 id="tt-drawer-title" className="tt-drawer__title">
            {title}
          </h2>
          <button
            type="button"
            className="tt-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="tt-drawer__body">{children}</div>
      </aside>
    </div>
  )
}

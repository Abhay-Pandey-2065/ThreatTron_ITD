interface EmptyStateProps {
  title?: string
  message: string
  icon?: string
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <div className="tt-empty-state">
      {icon && <span className="tt-empty-state__icon" aria-hidden>{icon}</span>}
      {title && <h3 className="tt-empty-state__title">{title}</h3>}
      <p className="tt-empty-state__message">{message}</p>
    </div>
  )
}

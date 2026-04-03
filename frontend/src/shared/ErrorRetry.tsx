interface ErrorRetryProps {
  message: string
  onRetry: () => void
}

export function ErrorRetry({ message, onRetry }: ErrorRetryProps) {
  return (
    <div className="tt-error-retry">
      <p className="tt-error-retry__message">{message}</p>
      <button type="button" className="tt-button tt-button--primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

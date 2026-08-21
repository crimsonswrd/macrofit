interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
}

/**
 * Page-level loading state (centered container, optional full-screen + message).
 * For an inline spinner inside a control (e.g. a button), use
 * `components/ui/Spinner` instead.
 */
export default function LoadingSpinner({ fullScreen = false, message }: LoadingSpinnerProps) {
  const containerClasses = fullScreen
    ? 'flex h-screen items-center justify-center bg-mist'
    : 'flex items-center justify-center py-16';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-3 animate-fade-in" role="status" aria-label={message ?? 'Загрузка'}>
        <span className="size-8 animate-spin rounded-full border-2 border-mist-2 border-t-flame-500" aria-hidden="true" />
        {message && <p className="text-sm font-medium text-ink-3">{message}</p>}
      </div>
    </div>
  );
}

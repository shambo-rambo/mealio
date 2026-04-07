interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-surface-container flex items-center justify-center mb-4">
        <span
          className="material-symbols-outlined text-[40px] text-on-surface-variant"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 40" }}
        >
          {icon}
        </span>
      </div>
      <h3 className="font-headline font-bold text-base text-on-surface mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-on-surface-variant mb-6 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-headline font-bold text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

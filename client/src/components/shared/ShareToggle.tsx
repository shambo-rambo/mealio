/** "Share with family" switch for a meal. Off = private: just for your own calories. */
export function ShareToggle({ shared, onChange }: { shared: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shared}
      onClick={() => onChange(!shared)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low text-left"
    >
      <span className="material-symbols-outlined text-[22px] text-primary">{shared ? 'group' : 'lock'}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-on-surface">{shared ? 'Shared with family' : 'Just me'}</span>
        <span className="block text-xs text-on-surface-variant">
          {shared ? 'Appears in the family plan and shopping list' : 'Counts toward your calories only'}
        </span>
      </span>
      <span className={`w-11 h-6 rounded-full p-0.5 flex-shrink-0 transition-colors ${shared ? 'bg-primary' : 'bg-outline-variant'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${shared ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

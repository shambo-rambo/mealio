import { create } from 'zustand'
import { useEffect } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastState {
  toasts: Toast[]
  add: (message: string, variant?: ToastVariant) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, variant = 'success') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().add(msg, 'success'),
  error: (msg: string) => useToastStore.getState().add(msg, 'error'),
  info: (msg: string) => useToastStore.getState().add(msg, 'info'),
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-primary text-on-primary',
  error: 'bg-error text-on-error',
  info: 'bg-surface-container-highest text-on-surface',
}

const variantIcons: Record<ToastVariant, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
}

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-card-md ${variantStyles[t.variant]} cursor-pointer`}
      onClick={onRemove}
    >
      <span className="material-symbols-outlined text-[20px]">{variantIcons[t.variant]}</span>
      <span className="font-body text-sm font-medium flex-1">{t.message}</span>
    </div>
  )
}

export function Toaster() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={() => remove(t.id)} />
        </div>
      ))}
    </div>
  )
}

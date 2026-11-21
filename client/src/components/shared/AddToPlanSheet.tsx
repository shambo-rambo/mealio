import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { toast } from './Toast'
import { useAddMealMutation, toLocalIso } from '../../hooks/usePlanner'
import type { MealLabel } from '../../types'

const LABELS: MealLabel[] = ['breakfast', 'lunch', 'dinner', 'snack']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Pick a day and meal, then put a recipe straight onto the meal plan. */
export function AddToPlanSheet({
  recipeId,
  open,
  onClose,
}: {
  recipeId: string | null
  open: boolean
  onClose: () => void
}) {
  const addMeal = useAddMealMutation()
  const [date, setDate] = useState(toLocalIso())
  const [label, setLabel] = useState<MealLabel>('dinner')

  useEffect(() => {
    if (open) {
      setDate(toLocalIso())
      setLabel('dinner')
    }
  }, [open])

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return { iso: toLocalIso(d), day: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAYS[d.getDay()], num: d.getDate() }
  })

  const handleAdd = async () => {
    if (!recipeId) return
    try {
      await addMeal.mutateAsync({ date, mealLabel: label, recipeId })
      toast.success('Added to plan')
      onClose()
    } catch {
      toast.error('Could not add to plan')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add to meal plan" size="md">
      <div className="space-y-4 pb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="radiogroup" aria-label="Day">
          {days.map((d) => (
            <button
              key={d.iso}
              role="radio"
              aria-checked={date === d.iso}
              onClick={() => setDate(d.iso)}
              className={`flex-shrink-0 w-14 py-2 rounded-2xl flex flex-col items-center transition-all ${
                date === d.iso ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <span className="text-[11px] font-medium">{d.day}</span>
              <span className="font-headline font-bold text-base">{d.num}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2" role="radiogroup" aria-label="Meal">
          {LABELS.map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={label === l}
              onClick={() => setLabel(l)}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                label === l ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={handleAdd}
          disabled={addMeal.isPending}
          className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
        >
          Add to plan
        </button>
      </div>
    </BottomSheet>
  )
}

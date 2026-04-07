import { useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { toast } from '../../components/shared/Toast'
import {
  useMealPlanQuery, useAddMealMutation, useUpdateMealMutation, useDeleteMealMutation,
  groupByDate, getWeekDates, formatDate,
} from '../../hooks/usePlanner'
import { useRecipesQuery, useRecipeQuery } from '../../hooks/useRecipes'
import { useListsQuery, useAddItemMutation } from '../../hooks/useLists'
import type { MealPlanEntry, MealLabel, Ingredient } from '../../types'

const LABEL_COLORS: Record<MealLabel, string> = {
  breakfast: 'bg-amber-100 text-amber-800',
  lunch: 'bg-sky-100 text-sky-800',
  dinner: 'bg-violet-100 text-violet-800',
}
const LABEL_SHORT: Record<MealLabel, string> = { breakfast: 'B', lunch: 'L', dinner: 'D' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthDates(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Shift so Monday is first (0=Mon)
  const offset = (firstDay + 6) % 7
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(iso)
  }
  return cells
}

// ── Meal chip (tiny badge on calendar cell) ───────────────────────────────────

function MealChip({ entry }: { entry: MealPlanEntry }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${LABEL_COLORS[entry.mealLabel]}`}>
      <span>{LABEL_SHORT[entry.mealLabel]}</span>
      <span className="truncate max-w-[60px]">{entry.recipe?.title ?? entry.noteText ?? '–'}</span>
    </div>
  )
}

// ── Ingredient pull sheet ─────────────────────────────────────────────────────

function IngredientPullSheet({
  entry,
  onClose,
}: {
  entry: MealPlanEntry | null
  onClose: () => void
}) {
  const { data: recipe } = useRecipeQuery(entry?.recipeId ?? null)
  const { data: lists = [] } = useListsQuery()
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [servings, setServings] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)

  const addItem = useAddItemMutation(selectedListId)

  const ingredients: Ingredient[] = recipe?.ingredients ?? []
  const baseServings = recipe?.servings ?? 1

  // Initialise selection when recipe loads
  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }
  const allSelected = selected.size === ingredients.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(ingredients.map((_, i) => i)))

  const handleAdd = async () => {
    if (!selectedListId || selected.size === 0) return
    setAdding(true)
    try {
      const factor = servings / baseServings
      await Promise.all(
        [...selected].map((i) => {
          const ing = ingredients[i]
          const qty = ing.quantity != null ? Math.round(ing.quantity * factor * 10) / 10 : null
          return addItem.mutateAsync({ name: ing.name, quantity: qty })
        })
      )
      toast.success(`${selected.size} ingredient${selected.size === 1 ? '' : 's'} added`)
      onClose()
    } catch {
      toast.error('Could not add ingredients')
    } finally {
      setAdding(false)
    }
  }

  // Pre-select all when ingredients load
  if (ingredients.length > 0 && selected.size === 0 && !adding) {
    setTimeout(() => setSelected(new Set(ingredients.map((_, i) => i))), 0)
  }

  if (!entry) return null

  return (
    <BottomSheet open={!!entry} onClose={onClose} title="Add to shopping list" size="lg">
      <div className="space-y-4 pb-4">
        {/* List selector */}
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Shopping list</p>
          {lists.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No lists yet — create one first.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedListId(l.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                    selectedListId === l.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Servings scaler */}
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex-1">Servings</p>
          <button onClick={() => setServings(Math.max(1, servings - 1))}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="font-headline font-bold text-on-surface w-6 text-center">{servings}</span>
          <button onClick={() => setServings(servings + 1)}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        {/* Ingredient checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Ingredients ({selected.size}/{ingredients.length})
            </p>
            <button onClick={toggleAll} className="text-xs text-primary font-bold">
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto no-scrollbar">
            {ingredients.map((ing, i) => {
              const factor = servings / baseServings
              const qty = ing.quantity != null ? Math.round(ing.quantity * factor * 10) / 10 : null
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                    selected.has(i) ? 'bg-primary/10' : 'bg-surface-container-low opacity-50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${selected.has(i) ? 'text-primary' : 'text-outline'}`}>
                    {selected.has(i) ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  <span className="text-sm font-medium text-primary min-w-[4rem]">
                    {qty != null ? `${qty % 1 === 0 ? qty : qty} ${ing.unit ?? ''}`.trim() : ing.unit ?? ''}
                  </span>
                  <span className="text-sm text-on-surface flex-1">{ing.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={adding || selected.size === 0 || !selectedListId}
          className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
        >
          {adding ? 'Adding…' : `Add ${selected.size} ingredient${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Delete scope modal ────────────────────────────────────────────────────────

function DeleteScopeModal({
  entry,
  onClose,
  onDeleted,
}: {
  entry: MealPlanEntry | null
  onClose: () => void
  onDeleted: () => void
}) {
  const deleteMeal = useDeleteMealMutation()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (scope: 'one' | 'series') => {
    if (!entry) return
    setDeleting(true)
    try {
      await deleteMeal.mutateAsync({ id: entry.id, scope })
      toast.success('Meal removed')
      onDeleted()
    } catch {
      toast.error('Could not remove meal')
    } finally {
      setDeleting(false)
    }
  }

  if (!entry) return null

  return (
    <BottomSheet open={!!entry} onClose={onClose} title="Remove meal" size="sm">
      <div className="space-y-3 pb-4">
        <p className="text-sm text-on-surface-variant">
          {entry.recipe?.title ?? entry.noteText ?? 'This meal'} is{' '}
          {entry.isRecurring ? 'a recurring meal.' : 'a one-off meal.'}
        </p>
        {entry.isRecurring && (
          <button
            onClick={() => handleDelete('series')}
            disabled={deleting}
            className="w-full py-3 rounded-full bg-error/10 text-error font-headline font-bold disabled:opacity-50"
          >
            Remove this & all future
          </button>
        )}
        <button
          onClick={() => handleDelete('one')}
          disabled={deleting}
          className="w-full py-3 rounded-full bg-error text-on-error font-headline font-bold disabled:opacity-50"
        >
          {entry.isRecurring ? 'Remove this one only' : 'Remove'}
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-full bg-surface-container text-on-surface font-headline font-bold">
          Cancel
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Day detail sheet ──────────────────────────────────────────────────────────

function DayDetailSheet({
  date,
  entries,
  onClose,
  onAddMeal,
  onPullIngredients,
}: {
  date: string | null
  entries: MealPlanEntry[]
  onClose: () => void
  onAddMeal: (date: string) => void
  onPullIngredients: (entry: MealPlanEntry) => void
}) {
  const updateMeal = useUpdateMealMutation()
  const [deletingEntry, setDeletingEntry] = useState<MealPlanEntry | null>(null)
  const [dayNote, setDayNote] = useState('')

  // Sync day note from the first entry when the sheet opens for a new date
  const firstEntry = entries[0]
  const savedNote = firstEntry?.dayNote ?? ''
  // Use useEffect-equivalent: track last seen date to reset local state
  const [lastDate, setLastDate] = useState<string | null>(null)
  if (date !== lastDate) {
    setLastDate(date)
    setDayNote(savedNote)
  }

  const saveDayNote = () => {
    if (!firstEntry || dayNote === savedNote) return
    updateMeal.mutate({ id: firstEntry.id, dayNote })
  }

  if (!date) return null
  const d = new Date(`${date}T00:00:00`)
  const dayName = d.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <BottomSheet open={!!date} onClose={onClose} title={dayName} size="lg">
        <div className="space-y-3 pb-4">
          {entries.length === 0 ? (
            <p className="text-on-surface-variant text-sm text-center py-4">Nothing planned for this day.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3">
                <span className={`px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${LABEL_COLORS[entry.mealLabel]}`}>
                  {entry.mealLabel.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface truncate">
                    {entry.recipe?.title ?? entry.noteText ?? '–'}
                  </p>
                  {entry.isRecurring && (
                    <p className="text-xs text-on-surface-variant">Recurring</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {entry.recipeId && (
                    <button
                      onClick={() => onPullIngredients(entry)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
                      title="Add ingredients to shopping list"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">shopping_cart</span>
                    </button>
                  )}
                  <button
                    onClick={() => setDeletingEntry(entry)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
          {/* Day note */}
          <div className="border-t border-outline-variant/30 pt-3">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Day note</p>
            <textarea
              value={dayNote}
              onChange={(e) => setDayNote(e.target.value)}
              onBlur={saveDayNote}
              placeholder={firstEntry ? 'e.g. We're out tonight — just cook for the kids' : 'Add a meal first to enable day notes'}
              disabled={!firstEntry}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-sm focus:outline-none focus:border-primary resize-none disabled:opacity-40"
            />
          </div>

          <button
            onClick={() => { onClose(); onAddMeal(date) }}
            className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add meal
          </button>
        </div>
      </BottomSheet>
      <DeleteScopeModal
        entry={deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onDeleted={() => setDeletingEntry(null)}
      />
    </>
  )
}

// ── Recurrence editor ─────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type RecurrenceRule = { freq: 'daily' | 'weekly' | 'fortnightly' | 'days'; days?: number[] } | null

function RecurrenceEditor({
  rule,
  onChange,
}: {
  rule: RecurrenceRule
  onChange: (rule: RecurrenceRule) => void
}) {
  const freqs = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly' },
    { value: 'daily', label: 'Daily' },
    { value: 'days', label: 'Custom days' },
  ] as const

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {freqs.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(rule?.freq === f.value ? null : { freq: f.value, days: [] })}
            className={`py-2 rounded-full text-sm font-bold transition-all ${
              rule?.freq === f.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {rule?.freq === 'days' && (
        <div className="flex gap-1 justify-between">
          {DAYS.map((day, i) => (
            <button
              key={i}
              onClick={() => {
                const days = rule.days ?? []
                const next = days.includes(i) ? days.filter((d) => d !== i) : [...days, i]
                onChange({ ...rule, days: next })
              }}
              className={`w-9 h-9 rounded-full text-xs font-bold transition-all ${
                rule.days?.includes(i) ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {day[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add meal sheet ────────────────────────────────────────────────────────────

function AddMealSheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  const addMeal = useAddMealMutation()
  const { data: recipes = [] } = useRecipesQuery()
  const [label, setLabel] = useState<MealLabel>('dinner')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [noteText, setNoteText] = useState('')
  const [mode, setMode] = useState<'recipe' | 'note'>('recipe')
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(null)
  const [showRecurrence, setShowRecurrence] = useState(false)

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(recipeSearch.toLowerCase()))

  const handleAdd = async (recipeId?: string) => {
    if (!date) return
    try {
      await addMeal.mutateAsync({
        date,
        mealLabel: label,
        recipeId: recipeId ?? null,
        noteText: mode === 'note' ? noteText : null,
        isRecurring: !!recurrence,
        recurrenceRule: recurrence ? JSON.stringify(recurrence) : null,
      })
      toast.success('Added to plan')
      onClose()
    } catch {
      toast.error('Could not add meal')
    }
  }

  return (
    <BottomSheet open={!!date} onClose={onClose} title="Add meal" size="lg">
      <div className="space-y-4 pb-4">
        {/* Meal label */}
        <div className="flex gap-2">
          {(['breakfast', 'lunch', 'dinner'] as MealLabel[]).map((l) => (
            <button
              key={l}
              onClick={() => setLabel(l)}
              className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                label === l ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 bg-surface-container-low p-1 rounded-full">
          {(['recipe', 'note'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                mode === m ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {m === 'recipe' ? 'From recipes' : 'Text note'}
            </button>
          ))}
        </div>

        {mode === 'recipe' ? (
          <>
            <input
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="Search recipes…"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {filtered.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => handleAdd(recipe.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-left"
                >
                  {recipe.pictureUrl ? (
                    <img src={recipe.pictureUrl} alt={recipe.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">restaurant_menu</span>
                    </div>
                  )}
                  <span className="font-medium text-on-surface text-sm flex-1 truncate">{recipe.title}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-on-surface-variant text-sm py-4">No recipes found</p>
              )}
            </div>
          </>
        ) : (
          <>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Takeaway night, order pizza"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary resize-none"
            />
            <button
              onClick={() => handleAdd()}
              disabled={!noteText.trim() || addMeal.isPending}
              className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
            >
              Add note
            </button>
          </>
        )}

        {/* Recurrence */}
        <div className="border-t border-outline-variant/30 pt-3">
          <button
            onClick={() => setShowRecurrence(!showRecurrence)}
            className="w-full flex items-center gap-2 text-sm text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">repeat</span>
            <span className="flex-1 text-left font-medium">
              {recurrence ? `Repeats ${recurrence.freq}` : 'Repeat…'}
            </span>
            {recurrence && (
              <button onClick={(e) => { e.stopPropagation(); setRecurrence(null) }}
                className="text-xs text-error font-bold px-2">
                Clear
              </button>
            )}
            <span className="material-symbols-outlined text-[18px]">
              {showRecurrence ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {showRecurrence && (
            <div className="mt-3">
              <RecurrenceEditor rule={recurrence} onChange={setRecurrence} />
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  byDate,
  onSelectDate,
}: {
  year: number
  month: number
  byDate: Record<string, MealPlanEntry[]>
  onSelectDate: (date: string) => void
}) {
  const cells = getMonthDates(year, month)
  const today = new Date().toISOString().slice(0, 10)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant uppercase py-1">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />
          const entries = byDate[date] ?? []
          const isToday = date === today
          const hasBreakfast = entries.some((e) => e.mealLabel === 'breakfast')
          const hasLunch = entries.some((e) => e.mealLabel === 'lunch')
          const hasDinner = entries.some((e) => e.mealLabel === 'dinner')
          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`flex flex-col items-center p-1 rounded-xl transition-colors min-h-[52px] ${
                isToday ? 'bg-primary/10' : 'hover:bg-surface-container-low'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-0.5 ${
                isToday ? 'bg-primary text-on-primary' : 'text-on-surface'
              }`}>
                <span className="text-xs font-bold">{new Date(`${date}T00:00:00`).getDate()}</span>
              </div>
              <div className="flex gap-0.5">
                {hasBreakfast && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                {hasLunch && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                {hasDinner && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main planner page ─────────────────────────────────────────────────────────

export function PlannerPage() {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addingToDate, setAddingToDate] = useState<string | null>(null)
  const [pullingEntry, setPullingEntry] = useState<MealPlanEntry | null>(null)

  // Week range
  const weekDates = getWeekDates(weekOffset)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  // Month range
  const today = new Date()
  const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`

  const start = view === 'week' ? weekStart : monthStart
  const end = view === 'week' ? weekEnd : monthEnd

  const { data: entries = [] } = useMealPlanQuery(start, end)
  const byDate = groupByDate(entries)

  const monthLabel = view === 'week'
    ? new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  const goBack = () => view === 'week' ? setWeekOffset(weekOffset - 1) : setMonthOffset(monthOffset - 1)
  const goForward = () => view === 'week' ? setWeekOffset(weekOffset + 1) : setMonthOffset(monthOffset + 1)
  const goToday = () => { setWeekOffset(0); setMonthOffset(0) }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar
        title="Meal Plan"
        showAvatar
        right={
          <div className="flex gap-2">
            <button onClick={goBack}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_left</span>
            </button>
            <button onClick={goToday}
              className="px-3 h-9 rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
              Today
            </button>
            <button onClick={goForward}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
            </button>
          </div>
        }
      />

      <div className="pt-20 px-4 mt-2">
        {/* Month label + view toggle */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{monthLabel}</p>
          <div className="flex bg-surface-container-low rounded-full p-0.5">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  view === v ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {view === 'week' ? (
          <>
            {/* 7-day grid */}
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date) => {
                const { day, date: dateNum, isToday } = formatDate(date)
                const dayEntries = byDate[date] ?? []
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center p-1.5 rounded-2xl transition-colors ${
                      isToday ? 'bg-primary/10' : selectedDate === date ? 'bg-surface-container-low' : 'hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">{day}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center my-1 ${
                      isToday ? 'bg-primary text-on-primary' : 'text-on-surface'
                    }`}>
                      <span className="font-headline font-bold text-sm">{dateNum}</span>
                    </div>
                    <div className="w-full space-y-0.5 min-h-[32px]">
                      {dayEntries.slice(0, 3).map((entry) => (
                        <MealChip key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Selected day detail (inline) */}
            {selectedDate && (byDate[selectedDate]?.length ?? 0) > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                {(byDate[selectedDate] ?? []).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl p-3 shadow-card">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${LABEL_COLORS[entry.mealLabel]}`}>
                      {entry.mealLabel.charAt(0).toUpperCase() + entry.mealLabel.slice(1)}
                    </span>
                    <p className="font-medium text-on-surface flex-1 truncate">{entry.recipe?.title ?? entry.noteText}</p>
                    {entry.recipeId && (
                      <button onClick={() => setPullingEntry(entry)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px] text-primary">shopping_cart</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <MonthView
            year={year}
            month={month}
            byDate={byDate}
            onSelectDate={(date) => setSelectedDate(date)}
          />
        )}

        {/* FAB */}
        <button
          onClick={() => setAddingToDate(selectedDate ?? (view === 'week' ? weekDates[0] : today.toISOString().slice(0, 10)))}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary shadow-fab flex items-center justify-center z-40"
        >
          <span className="material-symbols-outlined text-on-primary text-[24px]">add</span>
        </button>
      </div>

      <DayDetailSheet
        date={selectedDate}
        entries={byDate[selectedDate ?? ''] ?? []}
        onClose={() => setSelectedDate(null)}
        onAddMeal={(d) => setAddingToDate(d)}
        onPullIngredients={(entry) => { setSelectedDate(null); setPullingEntry(entry) }}
      />

      <AddMealSheet date={addingToDate} onClose={() => setAddingToDate(null)} />

      <IngredientPullSheet entry={pullingEntry} onClose={() => setPullingEntry(null)} />
    </div>
  )
}

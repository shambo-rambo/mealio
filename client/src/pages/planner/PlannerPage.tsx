import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { toast } from '../../components/shared/Toast'
import { AddToListSheet } from '../../components/shared/AddToListSheet'
import {
  useMealPlanQuery, useAddMealMutation, useUpdateMealMutation, useDeleteMealMutation,
  useSuggestMealMutation,
  groupByDate, getWeekDates, formatDate, toLocalIso,
} from '../../hooks/usePlanner'
import { useRecipesQuery } from '../../hooks/useRecipes'
import { queryKeys } from '../../lib/queryKeys'
import { api } from '../../lib/api'
import { DAILY_DOZEN, classifyDay, type DailyDozenId } from '../../lib/dailyDozen'
import { usePrefsStore } from '../../store/prefsStore'
import type { MealPlanEntry, MealLabel, Recipe, SuggestMessage, SuggestTurnResponse, RecipeImportResult } from '../../types'

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

function IngredientPullSheet({ entry, onClose }: { entry: MealPlanEntry | null; onClose: () => void }) {
  return <AddToListSheet recipeId={entry?.recipeId ?? null} open={!!entry} onClose={onClose} />
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
              placeholder={firstEntry ? "e.g. We're out tonight — just cook for the kids" : 'Add a meal first to enable day notes'}
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

// ── Day strip (horizontal scrollable week picker) ────────────────────────────

function DayStrip({
  dates,
  selected,
  byDate,
  onSelect,
}: {
  dates: string[]
  selected: string | null
  byDate: Record<string, MealPlanEntry[]>
  onSelect: (date: string) => void
}) {
  const today = toLocalIso()
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
      {dates.map((date) => {
        const d = new Date(`${date}T00:00:00`)
        const isToday = date === today
        const isSelected = date === selected
        const entries = byDate[date] ?? []
        const hasB = entries.some((e) => e.mealLabel === 'breakfast')
        const hasL = entries.some((e) => e.mealLabel === 'lunch')
        const hasD = entries.some((e) => e.mealLabel === 'dinner')

        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            className="flex flex-col items-center gap-1.5 min-w-[46px] py-1 flex-1"
          >
            <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${
              isSelected ? 'text-primary' : 'text-on-surface-variant/50'
            }`}>
              {d.toLocaleDateString('en-AU', { weekday: 'short' })}
            </span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              isToday && isSelected
                ? 'bg-primary text-on-primary shadow-md shadow-primary/25'
                : isToday
                ? 'ring-2 ring-primary text-primary'
                : isSelected
                ? 'bg-primary-container text-primary'
                : 'text-on-surface-variant/70'
            }`}>
              {d.getDate()}
            </div>
            <div className="flex gap-0.5 h-2 items-center">
              {hasB && <span className="w-1 h-1 rounded-full bg-amber-400" />}
              {hasL && <span className="w-1 h-1 rounded-full bg-sky-400" />}
              {hasD && <span className="w-1 h-1 rounded-full bg-violet-500" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Meal slot components ───────────────────────────────────────────────────────

const MEAL_SLOT_META: Record<MealLabel, { emoji: string; label: string }> = {
  breakfast: { emoji: '🌅', label: 'Breakfast' },
  lunch:     { emoji: '🥗', label: 'Lunch' },
  dinner:    { emoji: '🍽️', label: 'Dinner' },
}

const LABEL_TEXT_COLORS: Record<MealLabel, string> = {
  breakfast: 'text-amber-600',
  lunch:     'text-sky-600',
  dinner:    'text-violet-600',
}

function EmptyMealSlot({ label, onClick }: { label: MealLabel; onClick: () => void }) {
  const meta = MEAL_SLOT_META[label]
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed border-outline-variant/30 text-on-surface-variant hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-xl flex-shrink-0">
        {meta.emoji}
      </div>
      <span className="text-sm font-medium flex-1 text-left">Add {meta.label}</span>
      <span className="material-symbols-outlined text-[18px] opacity-40">add</span>
    </button>
  )
}

function MealEntryCard({
  entry,
  onEdit,
  onPullIngredients,
}: {
  entry: MealPlanEntry
  onEdit: () => void
  onPullIngredients: () => void
}) {
  return (
    <div
      onClick={onEdit}
      className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-2xl shadow-card active:scale-[0.98] transition-transform cursor-pointer"
    >
      {entry.recipe?.pictureUrl ? (
        <img
          src={entry.recipe.pictureUrl}
          alt=""
          className="w-[56px] h-[50px] rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-[56px] h-[50px] rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0 text-2xl">
          {MEAL_SLOT_META[entry.mealLabel].emoji}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${LABEL_TEXT_COLORS[entry.mealLabel]}`}>
          {entry.mealLabel}
        </p>
        <p className="font-headline font-semibold text-on-surface text-sm truncate">
          {entry.recipe?.title ?? entry.noteText ?? '–'}
        </p>
        {entry.isRecurring && (
          <p className="text-[10px] text-on-surface-variant mt-0.5 flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[11px]">repeat</span>
            Recurring
          </p>
        )}
      </div>
      {entry.recipeId && (
        <button
          onClick={(e) => { e.stopPropagation(); onPullIngredients() }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">shopping_cart</span>
        </button>
      )}
      <span className="material-symbols-outlined text-[18px] text-outline-variant flex-shrink-0">chevron_right</span>
    </div>
  )
}

// ── Day agenda (inline, replaces bottom sheet in week view) ───────────────────

function DayAgenda({
  entries,
  onAdd,
  onEdit,
  onPullIngredients,
}: {
  entries: MealPlanEntry[]
  onAdd: (label: MealLabel) => void
  onEdit: (entry: MealPlanEntry) => void
  onPullIngredients: (entry: MealPlanEntry) => void
}) {
  const mealSlots: MealLabel[] = ['breakfast', 'lunch', 'dinner']
  return (
    <div className="space-y-2.5">
      {mealSlots.map((slot) => {
        const slotEntries = entries.filter((e) => e.mealLabel === slot)
        return (
          <div key={slot} className="space-y-2">
            {slotEntries.length === 0 ? (
              <EmptyMealSlot label={slot} onClick={() => onAdd(slot)} />
            ) : (
              slotEntries.map((entry) => (
                <MealEntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => onEdit(entry)}
                  onPullIngredients={() => onPullIngredients(entry)}
                />
              ))
            )}
          </div>
        )
      })}
    </div>
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

const MEAL_LABEL_META: Record<MealLabel, { icon: string; color: string; active: string }> = {
  breakfast: { icon: '☀️', color: 'bg-surface-container text-amber-700', active: 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' },
  lunch:     { icon: '🥗', color: 'bg-surface-container text-sky-700',   active: 'bg-sky-100 text-sky-800 ring-2 ring-sky-400' },
  dinner:    { icon: '🍽️', color: 'bg-surface-container text-violet-700', active: 'bg-violet-100 text-violet-800 ring-2 ring-violet-400' },
}

type SimpleRepeat = 'none' | 'daily' | 'weekly'

// ── Suggest sheet ─────────────────────────────────────────────────────────────

const SUGGEST_OPENERS = [
  'How long do you have to cook?',
  'Anything in the fridge or freezer you want to use up?',
  'How many people are you cooking for?',
]

function getOpener() {
  return SUGGEST_OPENERS[Math.floor(Math.random() * SUGGEST_OPENERS.length)]
}

// A display-only message type — richer than what gets sent to the API
type DisplayMsg =
  | { kind: 'text'; role: 'user' | 'assistant'; content: string }
  | { kind: 'recipe'; importResult: RecipeImportResult }

function SuggestSheet({ date, mealLabel, onClose }: { date: string | null; mealLabel: MealLabel; onClose: () => void }) {
  const navigate = useNavigate()
  const suggest = useSuggestMealMutation()

  // displayMsgs drives the UI; apiMsgs is what goes to the server (text-only)
  const opener = getOpener()
  const [displayMsgs, setDisplayMsgs] = useState<DisplayMsg[]>([
    { kind: 'text', role: 'assistant', content: opener },
  ])
  const [apiMsgs, setApiMsgs] = useState<SuggestMessage[]>([
    { role: 'assistant', content: opener },
  ])
  const [latestRecipe, setLatestRecipe] = useState<RecipeImportResult | null>(null)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleResponse = (data: SuggestTurnResponse) => {
    if (data.type === 'question') {
      const msg: SuggestMessage = { role: 'assistant', content: data.text }
      setDisplayMsgs((prev) => [...prev, { kind: 'text', ...msg }])
      setApiMsgs((prev) => [...prev, msg])
    } else {
      const { importResult } = data
      // Add a rich recipe card to the display, and a text summary to the API context
      setDisplayMsgs((prev) => [...prev, { kind: 'recipe', importResult }])
      setApiMsgs((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I'd suggest ${importResult.title}. ${importResult.description ?? ''} Does that work for you?`.trim(),
        },
      ])
      setLatestRecipe(importResult)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMsgs, suggest.isPending])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || suggest.isPending) return
    const userMsg: SuggestMessage = { role: 'user', content: text }
    setDisplayMsgs((prev) => [...prev, { kind: 'text', ...userMsg }])
    const nextApi = [...apiMsgs, userMsg]
    setApiMsgs(nextApi)
    setInput('')
    suggest.mutate({ mealLabel, messages: nextApi }, { onSuccess: handleResponse })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleAddRecipe = () => {
    if (!latestRecipe || !date) return
    onClose()
    navigate('/recipes/import/review', {
      state: { importResult: latestRecipe, pendingMealPlan: { date, mealLabel } },
    })
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Chat log */}
      <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar pt-1">
        {displayMsgs.map((msg, i) =>
          msg.kind === 'recipe' ? (
            // ── Recipe card bubble ──────────────────────────────────────────
            <div key={i} className="flex justify-start">
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl rounded-bl-sm p-4 space-y-2 max-w-[90%]">
                <p className="font-headline font-bold text-on-surface text-sm leading-snug">{msg.importResult.title}</p>
                {msg.importResult.description && (
                  <p className="text-xs text-on-surface-variant leading-relaxed">{msg.importResult.description}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                  {msg.importResult.prepTime != null && (
                    <span>{msg.importResult.prepTime + (msg.importResult.cookTime ?? 0)} min</span>
                  )}
                  {msg.importResult.servings > 0 && <span>serves {msg.importResult.servings}</span>}
                </div>
                {msg.importResult.ingredients.length > 0 && (
                  <p className="text-xs text-on-surface-variant">
                    <span className="font-medium text-on-surface">Key ingredients: </span>
                    {msg.importResult.ingredients.slice(0, 5).map((ing) => ing.name).join(', ')}
                    {msg.importResult.ingredients.length > 5 ? ` + ${msg.importResult.ingredients.length - 5} more` : ''}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // ── Text bubble ─────────────────────────────────────────────────
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-on-primary rounded-br-sm'
                  : 'bg-surface-container text-on-surface rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {suggest.isPending && (
          <div className="flex justify-start">
            <div className="bg-surface-container px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {suggest.isError && (
        <p className="text-xs text-error text-center">Something went wrong — try again.</p>
      )}

      {/* Add recipe CTA — shown whenever there's a latest suggestion */}
      {latestRecipe && (
        <button
          onClick={handleAddRecipe}
          className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold text-sm"
        >
          Add recipe — {latestRecipe.title}
        </button>
      )}

      {/* Input — always visible so user can keep refining */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={latestRecipe ? 'Not quite right? Tell me more…' : 'Type your answer…'}
          rows={1}
          disabled={suggest.isPending}
          className="flex-1 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary resize-none text-sm disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || suggest.isPending}
          className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
        >
          <span className="material-symbols-outlined text-on-primary text-[20px]">arrow_upward</span>
        </button>
      </div>
    </div>
  )
}

// ── Add meal sheet ────────────────────────────────────────────────────────────

function AddMealSheet({ date, defaultLabel, onClose }: { date: string | null; defaultLabel?: MealLabel; onClose: () => void }) {
  const addMeal = useAddMealMutation()
  const { data: recipes = [] } = useRecipesQuery()
  const [label, setLabel] = useState<MealLabel>(defaultLabel ?? 'dinner')
  const [recipeSearch, setRecipeSearch] = useState('')
  const [noteText, setNoteText] = useState('')
  const [mode, setMode] = useState<'recipe' | 'note' | 'suggest'>('recipe')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [showRepeat, setShowRepeat] = useState(false)
  const [repeat, setRepeat] = useState<SimpleRepeat>('weekly')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedRule, setAdvancedRule] = useState<RecurrenceRule>(null)

  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(recipeSearch.toLowerCase()))
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null

  const recurrenceRule: RecurrenceRule = !showRepeat ? null
    : showAdvanced ? advancedRule
    : repeat === 'daily' ? { freq: 'daily' }
    : { freq: 'weekly' }

  const repeatLabel = !showRepeat ? 'Repeat'
    : showAdvanced ? 'Custom repeat'
    : repeat === 'daily' ? 'Every day'
    : 'Every week'

  const handleAdd = async (recipeId?: string) => {
    if (!date) return
    try {
      await addMeal.mutateAsync({
        date,
        mealLabel: label,
        recipeId: recipeId ?? null,
        noteText: mode === 'note' ? noteText : null,
        isRecurring: !!recurrenceRule,
        recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null,
      })
      toast.success('Added to plan')
      onClose()
    } catch {
      toast.error('Could not add meal')
    }
  }

  const toggleRepeat = () => {
    if (showRepeat) {
      setShowRepeat(false)
      setShowAdvanced(false)
    } else {
      setShowRepeat(true)
      setRepeat('weekly')
    }
  }

  return (
    <BottomSheet open={!!date} onClose={onClose} title="Add meal" size="lg">
      <div className="space-y-4 pb-4">

        {/* Mode toggle — at top so content below stays consistent */}
        <div className="flex gap-2 bg-surface-container-low p-1 rounded-full">
          {(['recipe', 'note', 'suggest'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                mode === m ? 'bg-surface-container-lowest shadow-sm text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {m === 'recipe' ? 'Recipes' : m === 'note' ? 'Note' : 'Suggest'}
            </button>
          ))}
        </div>

        {/* Meal label — always visible, just below mode toggle */}
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Meal</p>
          <div className="flex gap-2">
            {(['breakfast', 'lunch', 'dinner'] as MealLabel[]).map((l) => {
              const meta = MEAL_LABEL_META[l]
              return (
                <button
                  key={l}
                  onClick={() => setLabel(l)}
                  className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    label === l ? meta.active : meta.color
                  }`}
                >
                  <span className="text-lg mb-0.5">{meta.icon}</span>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        {mode === 'suggest' ? (
          <SuggestSheet date={date} mealLabel={label} onClose={onClose} />
        ) : mode === 'recipe' ? (
          <>
            <input
              value={recipeSearch}
              onChange={(e) => { setRecipeSearch(e.target.value); setSelectedRecipeId(null) }}
              placeholder="Search recipes…"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
            />
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
              {filtered.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedRecipeId(recipe.id === selectedRecipeId ? null : recipe.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                    recipe.id === selectedRecipeId
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  {recipe.pictureUrl ? (
                    <img src={recipe.pictureUrl} alt={recipe.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">restaurant_menu</span>
                    </div>
                  )}
                  <span className="font-medium text-on-surface text-sm flex-1 truncate">{recipe.title}</span>
                  {recipe.id === selectedRecipeId && (
                    <span className="material-symbols-outlined text-primary text-[20px] flex-shrink-0">check_circle</span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-on-surface-variant text-sm py-4">No recipes found</p>
              )}
            </div>

            {/* Action bar — appears after recipe is selected */}
            {selectedRecipe && (
              <div className="space-y-3 pt-1">
                <button
                  onClick={toggleRepeat}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    showRepeat ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">repeat</span>
                  {repeatLabel}
                </button>
                {showRepeat && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {(['weekly', 'daily'] as SimpleRepeat[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => { setRepeat(r); setShowAdvanced(false) }}
                          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                            !showAdvanced && repeat === r ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {r === 'weekly' ? 'Every week' : 'Every day'}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                          showAdvanced ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {showAdvanced && <RecurrenceEditor rule={advancedRule} onChange={setAdvancedRule} />}
                  </div>
                )}
                <button
                  onClick={() => handleAdd(selectedRecipe.id)}
                  disabled={addMeal.isPending}
                  className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
                >
                  {addMeal.isPending ? 'Adding…' : `Add ${selectedRecipe.title}`}
                </button>
              </div>
            )}
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
            {noteText.trim() && (
              <div className="space-y-3">
                <button
                  onClick={toggleRepeat}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    showRepeat ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">repeat</span>
                  {repeatLabel}
                </button>
                {showRepeat && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {(['weekly', 'daily'] as SimpleRepeat[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => { setRepeat(r); setShowAdvanced(false) }}
                          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                            !showAdvanced && repeat === r ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {r === 'weekly' ? 'Every week' : 'Every day'}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                          showAdvanced ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {showAdvanced && <RecurrenceEditor rule={advancedRule} onChange={setAdvancedRule} />}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => handleAdd()}
              disabled={!noteText.trim() || addMeal.isPending}
              className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50"
            >
              {addMeal.isPending ? 'Adding…' : 'Add note'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// ── Edit meal sheet ───────────────────────────────────────────────────────────

function EditMealSheet({ entry, onClose }: { entry: MealPlanEntry | null; onClose: () => void }) {
  const updateMeal = useUpdateMealMutation()
  const deleteMeal = useDeleteMealMutation()
  const [label, setLabel] = useState<MealLabel>('dinner')
  const [repeat, setRepeat] = useState<SimpleRepeat>('none')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedRule, setAdvancedRule] = useState<RecurrenceRule>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)

  // Sync state when a different entry is opened
  if (entry && entry.id !== lastId) {
    setLastId(entry.id)
    setLabel(entry.mealLabel)
    setConfirmDelete(false)
    if (entry.recurrenceRule) {
      try {
        const rule = JSON.parse(entry.recurrenceRule) as RecurrenceRule | null
        if (!rule) { setRepeat('none'); setShowAdvanced(false) }
        else if (rule.freq === 'daily') { setRepeat('daily'); setShowAdvanced(false) }
        else if (rule.freq === 'weekly') { setRepeat('weekly'); setShowAdvanced(false) }
        else { setRepeat('none'); setShowAdvanced(true); setAdvancedRule(rule) }
      } catch { setRepeat('none'); setShowAdvanced(false) }
    } else {
      setRepeat('none')
      setShowAdvanced(false)
      setAdvancedRule(null)
    }
  }

  const recurrenceRule: RecurrenceRule =
    showAdvanced ? advancedRule
    : repeat === 'daily' ? { freq: 'daily' }
    : repeat === 'weekly' ? { freq: 'weekly' }
    : null

  const handleSave = async () => {
    if (!entry) return
    try {
      await updateMeal.mutateAsync({
        id: entry.id,
        mealLabel: label,
        isRecurring: !!recurrenceRule,
        recurrenceRule: recurrenceRule ? JSON.stringify(recurrenceRule) : null,
      })
      toast.success('Meal updated')
      onClose()
    } catch {
      toast.error('Could not update meal')
    }
  }

  const handleDelete = async (scope: 'one' | 'series') => {
    if (!entry) return
    try {
      await deleteMeal.mutateAsync({ id: entry.id, scope })
      toast.success('Meal removed')
      onClose()
    } catch {
      toast.error('Could not remove meal')
    }
  }

  return (
    <BottomSheet open={!!entry} onClose={onClose} title="Edit meal" size="lg">
      <div className="space-y-4 pb-4">
        {/* Current meal preview */}
        {entry && (
          <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
            <span className="text-2xl flex-shrink-0">{MEAL_SLOT_META[entry.mealLabel].emoji}</span>
            <p className="font-semibold text-on-surface text-sm flex-1 truncate">
              {entry.recipe?.title ?? entry.noteText ?? '–'}
            </p>
          </div>
        )}

        {/* Meal label */}
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Meal</p>
          <div className="flex gap-2">
            {(['breakfast', 'lunch', 'dinner'] as MealLabel[]).map((l) => {
              const meta = MEAL_LABEL_META[l]
              return (
                <button key={l} onClick={() => setLabel(l)}
                  className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl text-xs font-bold transition-all ${label === l ? meta.active : meta.color}`}>
                  <span className="text-lg mb-0.5">{meta.icon}</span>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Repeat */}
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Repeat</p>
          <div className="flex gap-2">
            {(['none', 'daily', 'weekly'] as SimpleRepeat[]).map((r) => (
              <button key={r} onClick={() => { setRepeat(r); setShowAdvanced(false) }}
                className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                  !showAdvanced && repeat === r ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                }`}>
                {r === 'none' ? 'No repeat' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
            <button onClick={() => { setShowAdvanced(!showAdvanced); setRepeat('none') }}
              className={`px-3 py-2 rounded-full text-sm font-bold transition-all ${
                showAdvanced ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}>
              More
            </button>
          </div>
          {showAdvanced && <div className="mt-3"><RecurrenceEditor rule={advancedRule} onChange={setAdvancedRule} /></div>}
        </div>

        <button onClick={handleSave} disabled={updateMeal.isPending}
          className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold disabled:opacity-50">
          {updateMeal.isPending ? 'Saving…' : 'Save changes'}
        </button>

        {/* Delete section */}
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full py-3 rounded-full bg-error/10 text-error font-headline font-bold">
            Remove meal
          </button>
        ) : (
          <div className="space-y-2 pt-1">
            {entry?.isRecurring && (
              <button onClick={() => handleDelete('series')} disabled={deleteMeal.isPending}
                className="w-full py-3 rounded-full bg-error/10 text-error font-headline font-bold disabled:opacity-50">
                Remove this & all future
              </button>
            )}
            <button onClick={() => handleDelete('one')} disabled={deleteMeal.isPending}
              className="w-full py-3 rounded-full bg-error text-on-error font-headline font-bold disabled:opacity-50">
              {entry?.isRecurring ? 'Remove this one only' : 'Remove'}
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="w-full py-3 rounded-full bg-surface-container text-on-surface font-headline font-bold">
              Cancel
            </button>
          </div>
        )}
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
  const today = toLocalIso()
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

// ── Daily Dozen strip (bottom of day view) ────────────────────────────────────

function DailyDozenStrip({
  todayCategories,
  periodCategories,
}: {
  todayCategories: Set<DailyDozenId>
  periodCategories: Set<DailyDozenId>  // categories hit anywhere in the current week/month
}) {
  return (
    <div className="mt-6 pt-5 border-t border-outline-variant/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Daily Dozen
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Today
          </span>
          <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> This week
          </span>
          <span className="flex items-center gap-1 text-[9px] text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-outline-variant/40 inline-block" /> Missing
          </span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {DAILY_DOZEN.map((item) => {
          const hasToday = todayCategories.has(item.id)
          const hasPeriod = periodCategories.has(item.id)

          const cardBg = hasToday
            ? 'bg-green-50 border-green-200'
            : hasPeriod
            ? 'bg-amber-50 border-amber-200'
            : 'bg-surface-container border-outline-variant/20'

          const emojiRing = hasToday
            ? 'bg-green-500'
            : hasPeriod
            ? 'bg-amber-400'
            : 'bg-outline-variant/30'

          const labelColor = hasToday
            ? 'text-green-800'
            : hasPeriod
            ? 'text-amber-800'
            : 'text-on-surface-variant/50'

          return (
            <div key={item.id} className={`rounded-2xl border p-2 flex flex-col items-center gap-1.5 transition-colors ${cardBg}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${emojiRing}`}>
                {item.emoji}
              </div>
              <p className={`text-[9px] text-center leading-tight font-semibold ${labelColor}`}>
                {item.shortName}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Weekly Dozen summary ──────────────────────────────────────────────────────

function WeeklyDozenSummary({
  weekDates,
  categoryByDate,
}: {
  weekDates: string[]
  categoryByDate: Record<string, Set<DailyDozenId>>
}) {
  const today = toLocalIso()
  // Only count days up to today (don't penalise future days)
  const pastDates = weekDates.filter((d) => d <= today)
  const totalDays = pastDates.length || 1

  return (
    <div className="mt-8 pt-5 border-t border-outline-variant/20">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        Week Summary
      </p>
      <div className="grid grid-cols-5 gap-2">
        {DAILY_DOZEN.map((item) => {
          const hitCount = pastDates.filter((d) => categoryByDate[d]?.has(item.id)).length
          const isGreen = hitCount >= totalDays && totalDays > 0
          const isAmber = !isGreen && hitCount > 0

          const cardBg = isGreen
            ? 'bg-green-50 border-green-200'
            : isAmber
            ? 'bg-amber-50 border-amber-200'
            : 'bg-surface-container border-outline-variant/20'

          const dotActive = isGreen ? 'bg-green-500' : 'bg-amber-400'

          return (
            <div key={item.id} className={`rounded-xl p-2.5 border ${cardBg}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base leading-none">{item.emoji}</span>
                <p className={`text-[10px] font-bold truncate ${
                  isGreen ? 'text-green-800' : isAmber ? 'text-amber-800' : 'text-on-surface-variant/60'
                }`}>
                  {item.shortName}
                </p>
              </div>
              {/* One dot per day of the week */}
              <div className="flex gap-[3px]">
                {weekDates.map((date) => {
                  const hit = categoryByDate[date]?.has(item.id)
                  const isFuture = date > today
                  return (
                    <div
                      key={date}
                      className={`flex-1 h-1.5 rounded-full ${
                        hit ? dotActive : isFuture ? 'bg-outline-variant/10' : 'bg-outline-variant/25'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main planner page ─────────────────────────────────────────────────────────

export function PlannerPage() {
  const todayIso = toLocalIso()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(todayIso)
  const [addingToDate, setAddingToDate] = useState<string | null>(null)
  const [addingLabel, setAddingLabel] = useState<MealLabel | undefined>(undefined)
  const [pullingEntry, setPullingEntry] = useState<MealPlanEntry | null>(null)
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null)
  const { dailyDozenEnabled } = usePrefsStore()

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

  // ── Daily Dozen data ──────────────────────────────────────────────────────
  // Fetch full recipe details for every unique recipe in the visible range so
  // we can classify individual ingredients (more accurate than title alone).
  const visibleRecipeIds = [...new Set(entries.filter((e) => e.recipeId).map((e) => e.recipeId!))]
  const recipeDetailQueries = useQueries({
    queries: visibleRecipeIds.map((id) => ({
      queryKey: queryKeys.recipes.detail(id),
      queryFn: () => api.get<{ recipe: Recipe }>(`/recipes/${id}`).then((r) => r.data.recipe),
      staleTime: 5 * 60_000,
    })),
  })
  const recipeMap: Record<string, Recipe> = {}
  for (const q of recipeDetailQueries) {
    if (q.data) recipeMap[q.data.id] = q.data
  }

  // Classify each date in the visible range
  const categoryByDate: Record<string, Set<DailyDozenId>> = {}
  for (const [date, dayEntries] of Object.entries(byDate)) {
    categoryByDate[date] = classifyDay(
      dayEntries.map((e) => ({
        recipeTitle: e.recipe?.title,
        ingredientNames: e.recipeId
          ? (recipeMap[e.recipeId]?.ingredients?.map((i) => i.name) ?? [])
          : [],
        noteText: e.noteText,
        dayNote: e.dayNote,
      }))
    )
  }

  // Union of all categories present anywhere in the visible period
  const periodCategories = new Set<DailyDozenId>()
  for (const cats of Object.values(categoryByDate)) {
    for (const id of cats) periodCategories.add(id)
  }

  const monthLabel = view === 'week'
    ? new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  const goBack = () => view === 'week' ? setWeekOffset(weekOffset - 1) : setMonthOffset(monthOffset - 1)
  const goForward = () => view === 'week' ? setWeekOffset(weekOffset + 1) : setMonthOffset(monthOffset + 1)
  const goToday = () => { setWeekOffset(0); setMonthOffset(0); setSelectedDate(todayIso) }

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
            {/* Horizontal day strip */}
            <DayStrip
              dates={weekDates}
              selected={selectedDate}
              byDate={byDate}
              onSelect={setSelectedDate}
            />

            {/* Selected day agenda — always shown below strip */}
            {selectedDate && (
              <div className="mt-6">
                {/* Day header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    {selectedDate === todayIso && (
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Today</p>
                    )}
                    <h2 className="font-headline font-bold text-lg text-on-surface">
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h2>
                  </div>
                  <button
                    onClick={() => { setAddingLabel(undefined); setAddingToDate(selectedDate) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add meal
                  </button>
                </div>

                <DayAgenda
                  entries={byDate[selectedDate] ?? []}
                  onAdd={(label) => { setAddingLabel(label); setAddingToDate(selectedDate) }}
                  onEdit={(entry) => setEditingEntry(entry)}
                  onPullIngredients={(entry) => setPullingEntry(entry)}
                />

                {dailyDozenEnabled && (
                  <DailyDozenStrip
                    todayCategories={categoryByDate[selectedDate] ?? new Set()}
                    periodCategories={periodCategories}
                  />
                )}
              </div>
            )}

            {dailyDozenEnabled && (
              <WeeklyDozenSummary
                weekDates={weekDates}
                categoryByDate={categoryByDate}
              />
            )}
          </>
        ) : (
          <>
            {/* Month calendar — tap a date to see its agenda below */}
            <MonthView
              year={year}
              month={month}
              byDate={byDate}
              onSelectDate={setSelectedDate}
            />

            {/* Inline day agenda for selected date in month view */}
            {selectedDate && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    {selectedDate === todayIso && (
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Today</p>
                    )}
                    <h2 className="font-headline font-bold text-lg text-on-surface">
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h2>
                  </div>
                  <button
                    onClick={() => { setAddingLabel(undefined); setAddingToDate(selectedDate) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add meal
                  </button>
                </div>
                <DayAgenda
                  entries={byDate[selectedDate] ?? []}
                  onAdd={(label) => { setAddingLabel(label); setAddingToDate(selectedDate) }}
                  onEdit={(entry) => setEditingEntry(entry)}
                  onPullIngredients={(entry) => setPullingEntry(entry)}
                />

                {dailyDozenEnabled && (
                  <DailyDozenStrip
                    todayCategories={categoryByDate[selectedDate] ?? new Set()}
                    periodCategories={periodCategories}
                  />
                )}
              </div>
            )}
          </>
        )}

      </div>

      <AddMealSheet
        key={`${addingToDate}-${addingLabel}`}
        date={addingToDate}
        defaultLabel={addingLabel}
        onClose={() => { setAddingToDate(null); setAddingLabel(undefined) }}
      />

      <IngredientPullSheet entry={pullingEntry} onClose={() => setPullingEntry(null)} />

      <EditMealSheet
        key={editingEntry?.id}
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
      />
    </div>
  )
}

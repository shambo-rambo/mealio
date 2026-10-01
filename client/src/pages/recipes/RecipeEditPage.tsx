import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { Skeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { useRecipeQuery, useUpdateRecipeMutation } from '../../hooks/useRecipes'
import { DIETARY_TAG_LABELS, type DietaryTag } from '../../types'

const DIET_TAGS: DietaryTag[] = ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_free']

type FormState = {
  title: string
  sourceUrl: string | null
  servings: number
  prepTime: number | null
  cookTime: number | null
  notes: string
  ingredients: Array<{ name: string; quantity: number | null; unit: string; prepNote: string }>
  steps: Array<{ instruction: string }>
  dietaryTags: DietaryTag[]
  nutrition: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null }
}

export function RecipeEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipeQuery(id ?? null)
  const updateRecipe = useUpdateRecipeMutation(id!)

  const [form, setForm] = useState<FormState>({
    title: '',
    sourceUrl: null,
    servings: 4,
    prepTime: null,
    cookTime: null,
    notes: '',
    ingredients: [{ name: '', quantity: null, unit: '', prepNote: '' }],
    steps: [{ instruction: '' }],
    dietaryTags: [],
    nutrition: { calories: null, protein: null, carbs: null, fat: null },
  })

  // Pre-populate once recipe loads
  useEffect(() => {
    if (!recipe) return
    setForm({
      title: recipe.title,
      sourceUrl: recipe.sourceUrl ?? null,
      servings: recipe.servings,
      prepTime: recipe.prepTime ?? null,
      cookTime: recipe.cookTime ?? null,
      notes: recipe.notes ?? '',
      ingredients: recipe.ingredients?.length
        ? recipe.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit ?? '', prepNote: i.prepNote ?? '' }))
        : [{ name: '', quantity: null, unit: '', prepNote: '' }],
      steps: recipe.steps?.length
        ? recipe.steps.map((s) => ({ instruction: s.instruction }))
        : [{ instruction: '' }],
      dietaryTags: (recipe.dietaryTags ?? []) as DietaryTag[],
      nutrition: recipe.nutrition
        ? { calories: recipe.nutrition.calories, protein: recipe.nutrition.protein, carbs: recipe.nutrition.carbs, fat: recipe.nutrition.fat }
        : { calories: null, protein: null, carbs: null, fat: null },
    })
  }, [recipe?.id])

  const toggleTag = (tag: DietaryTag) => {
    setForm((f) => ({
      ...f,
      dietaryTags: f.dietaryTags.includes(tag)
        ? f.dietaryTags.filter((t) => t !== tag)
        : [...f.dietaryTags, tag],
    }))
  }

  const save = async () => {
    if (!form.title.trim()) { toast.error('Recipe title is required'); return }
    try {
      await updateRecipe.mutateAsync({
        ...form,
        ingredients: form.ingredients.filter((i) => i.name.trim()),
        steps: form.steps.filter((s) => s.instruction.trim()),
        nutrition: Object.values(form.nutrition).some((v) => v != null) ? form.nutrition : null,
      } as any)
      navigate(`/recipes/${id}`, { replace: true })
      toast.success('Recipe updated!')
    } catch {
      toast.error('Could not update recipe')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-10">
        <TopBar title="Edit recipe" showBack />
        <div className="pt-topbar px-6 mt-4 space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-10">
      <TopBar title="Edit recipe" showBack />

      <div className="pt-topbar px-6 mt-4 space-y-6">
        {/* Basics */}
        <section className="space-y-4">
          <h2 className="font-headline font-bold text-xs text-on-surface-variant uppercase tracking-widest">Basics</h2>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Recipe title"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface text-lg font-headline font-bold focus:outline-none focus:border-primary"
          />
          <input
            value={form.sourceUrl ?? ''}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value || null })}
            placeholder="Source URL (optional)"
            className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Servings', key: 'servings', min: 1 },
              { label: 'Prep (min)', key: 'prepTime', min: 0 },
              { label: 'Cook (min)', key: 'cookTime', min: 0 },
            ].map(({ label, key, min }) => (
              <div key={key}>
                <label className="block text-xs text-on-surface-variant mb-1">{label}</label>
                <input
                  type="number"
                  min={min}
                  value={(form as any)[key] ?? ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value ? parseInt(e.target.value) : null } as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-center"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Dietary tags */}
        <section className="space-y-3">
          <h2 className="font-headline font-bold text-xs text-on-surface-variant uppercase tracking-widest">Dietary tags</h2>
          <div className="flex flex-wrap gap-2">
            {DIET_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  form.dietaryTags.includes(tag)
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant'
                }`}
              >
                {DIETARY_TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </section>

        {/* Ingredients */}
        <section className="space-y-3">
          <h2 className="font-headline font-bold text-xs text-on-surface-variant uppercase tracking-widest">Ingredients</h2>
          <div className="space-y-2">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={ing.quantity ?? ''}
                  onChange={(e) => {
                    const ings = [...form.ingredients]
                    ings[i] = { ...ings[i], quantity: e.target.value ? parseFloat(e.target.value) : null }
                    setForm({ ...form, ingredients: ings })
                  }}
                  placeholder="Qty"
                  type="number"
                  className="w-16 px-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-center text-sm"
                />
                <input
                  value={ing.unit}
                  onChange={(e) => {
                    const ings = [...form.ingredients]
                    ings[i] = { ...ings[i], unit: e.target.value }
                    setForm({ ...form, ingredients: ings })
                  }}
                  placeholder="Unit"
                  className="w-20 px-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
                />
                <input
                  value={ing.name}
                  onChange={(e) => {
                    const ings = [...form.ingredients]
                    ings[i] = { ...ings[i], name: e.target.value }
                    setForm({ ...form, ingredients: ings })
                  }}
                  placeholder="Ingredient name"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm"
                />
                <button onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px] text-error">remove_circle</span>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setForm({ ...form, ingredients: [...form.ingredients, { name: '', quantity: null, unit: '', prepNote: '' }] })}
            className="flex items-center gap-2 text-primary font-bold text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add ingredient
          </button>
        </section>

        {/* Steps */}
        <section className="space-y-3">
          <h2 className="font-headline font-bold text-xs text-on-surface-variant uppercase tracking-widest">Steps</h2>
          <div className="space-y-3">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-2.5">
                  <span className="font-headline font-bold text-xs text-on-primary">{i + 1}</span>
                </div>
                <textarea
                  value={step.instruction}
                  onChange={(e) => {
                    const steps = [...form.steps]
                    steps[i] = { instruction: e.target.value }
                    setForm({ ...form, steps })
                  }}
                  placeholder={`Step ${i + 1}…`}
                  rows={2}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary text-sm resize-none"
                />
                <button onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-2">
                  <span className="material-symbols-outlined text-[18px] text-error">remove_circle</span>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setForm({ ...form, steps: [...form.steps, { instruction: '' }] })}
            className="flex items-center gap-2 text-primary font-bold text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add step
          </button>
        </section>

        {/* Notes */}
        <section className="space-y-3">
          <h2 className="font-headline font-bold text-xs text-on-surface-variant uppercase tracking-widest">Notes</h2>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any notes about this recipe…"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary resize-none"
          />
        </section>

        <button
          onClick={save}
          disabled={updateRecipe.isPending}
          className="w-full py-4 rounded-full bg-primary text-on-primary font-headline font-bold text-base shadow-fab disabled:opacity-50"
        >
          {updateRecipe.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

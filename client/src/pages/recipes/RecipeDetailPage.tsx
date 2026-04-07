import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { BottomSheet } from '../../components/shared/BottomSheet'
import { Skeleton } from '../../components/shared/Skeleton'
import { toast } from '../../components/shared/Toast'
import { useRecipeQuery, useRateRecipeMutation, useDeleteRecipeMutation, scaleIngredients } from '../../hooks/useRecipes'
import { DIETARY_TAG_LABELS, type DietaryTag } from '../../types'
import { api } from '../../lib/api'

function StarRating({ current, onRate }: { current: number | null; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= (hover || current || 0)
        return (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate(s)}
            className="p-0.5"
          >
            <span className="material-symbols-outlined text-[22px] text-yellow-400"
              style={{ fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>
              star
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: recipe, isLoading } = useRecipeQuery(id ?? null)
  const rateRecipe = useRateRecipeMutation(id!)
  const deleteRecipe = useDeleteRecipeMutation()
  const [servings, setServings] = useState<number | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [scaleByIngredient, setScaleByIngredient] = useState(false)

  const currentServings = servings ?? recipe?.servings ?? 1
  const scaledIngredients = recipe?.ingredients
    ? scaleIngredients(recipe.ingredients, recipe.servings, currentServings)
    : []

  const handleIngredientScale = (idx: number, newQty: number) => {
    if (!recipe?.ingredients) return
    const original = recipe.ingredients[idx]?.quantity
    if (!original || original === 0) return
    const ratio = newQty / original
    const derived = Math.round(recipe.servings * ratio * 10) / 10
    setServings(derived)
  }

  const handleRate = async (rating: number) => {
    try {
      await rateRecipe.mutateAsync(rating)
      toast.success('Rating saved')
    } catch {
      toast.error('Could not save rating')
    }
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      const { data } = await api.post<{ shareToken: string; url: string }>(`/recipes/${id}/share`, {})
      setShareUrl(data.url)
      setShowShare(true)
    } catch {
      toast.error('Could not generate share link')
    } finally {
      setSharing(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteRecipe.mutateAsync(id!)
      navigate('/recipes', { replace: true })
      toast.success('Recipe deleted')
    } catch {
      toast.error('Could not delete recipe')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface pb-28">
        <TopBar title="" showBack />
        <div className="pt-20 space-y-4 px-6 mt-4">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!recipe) return null

  const tagColors: Record<DietaryTag, string> = {
    vegetarian: 'bg-green-100 text-green-800',
    vegan: 'bg-emerald-100 text-emerald-800',
    gluten_free: 'bg-amber-100 text-amber-800',
    dairy_free: 'bg-blue-100 text-blue-800',
    nut_free: 'bg-orange-100 text-orange-800',
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar
        title={recipe.title}
        showBack
        right={
          <div className="flex gap-2">
            <button onClick={handleShare} disabled={sharing}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center disabled:opacity-50">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">share</span>
            </button>
            <button onClick={() => navigate(`/recipes/${id}/edit`)}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
            </button>
            <button onClick={() => setShowDelete(true)}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-error">delete</span>
            </button>
          </div>
        }
      />

      <div className="pt-16">
        {/* Hero image */}
        {recipe.pictureUrl ? (
          <img src={recipe.pictureUrl} alt={recipe.title} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-40 bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[56px] text-on-surface-variant/30"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 56" }}>
              restaurant_menu
            </span>
          </div>
        )}

        <div className="px-6 space-y-6 mt-4">
          {/* Title + meta */}
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">{recipe.title}</h1>

            {/* Time chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {recipe.prepTime && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">timer</span>
                  {recipe.prepTime}m prep
                </span>
              )}
              {recipe.cookTime && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">cooking</span>
                  {recipe.cookTime}m cook
                </span>
              )}
              {recipe.preparedCount > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-fixed/50 text-xs font-medium text-primary">
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  Made {recipe.preparedCount}×
                </span>
              )}
            </div>

            {/* Dietary tags */}
            {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {recipe.dietaryTags.map((tag) => (
                  <span key={tag} className={`px-2.5 py-1 rounded-full text-xs font-bold ${tagColors[tag as DietaryTag]}`}>
                    {DIETARY_TAG_LABELS[tag as DietaryTag]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Your rating</p>
            <StarRating current={recipe.userRating ?? null} onRate={handleRate} />
            {recipe.averageRating && (
              <p className="text-xs text-on-surface-variant mt-2">
                Family average: {recipe.averageRating.toFixed(1)} / 5
              </p>
            )}
          </div>

          {/* Servings scaler */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Ingredients</p>
              {!scaleByIngredient && (
                <div className="flex items-center gap-3 bg-surface-container-low rounded-full px-1 py-1">
                  <button
                    onClick={() => setServings(Math.max(1, currentServings - 1))}
                    className="w-7 h-7 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface">remove</span>
                  </button>
                  <span className="font-headline font-bold text-sm text-on-surface w-16 text-center">
                    {currentServings} {currentServings === 1 ? 'serving' : 'servings'}
                  </span>
                  <button
                    onClick={() => setServings(currentServings + 1)}
                    className="w-7 h-7 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface">add</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setScaleByIngredient((v) => !v)}
              className={`mb-3 flex items-center gap-2 text-xs font-bold transition-colors ${scaleByIngredient ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Scale by ingredient
            </button>

            <div className="bg-surface-container-lowest rounded-xl shadow-card overflow-hidden">
              {scaledIngredients.map((ing, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-outline-variant/20' : ''}`}>
                  {scaleByIngredient && ing.scaled != null ? (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      defaultValue={ing.scaled % 1 === 0 ? ing.scaled : ing.scaled.toFixed(1)}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v) && v > 0) handleIngredientScale(i, v)
                      }}
                      className="w-16 px-2 py-1 rounded-lg bg-surface-container border border-primary text-primary font-headline font-bold text-sm text-center focus:outline-none"
                    />
                  ) : (
                    <span className="font-headline font-bold text-sm text-primary min-w-[3.5rem]">
                      {ing.scaled != null ? (
                        <>
                          {ing.isRounded && <span className="text-on-surface-variant">~</span>}
                          {ing.scaled % 1 === 0 ? ing.scaled : ing.scaled.toFixed(1)}
                          {ing.unit && ` ${ing.unit}`}
                        </>
                      ) : ing.unit ? ing.unit : '–'}
                    </span>
                  )}
                  {scaleByIngredient && ing.unit && (
                    <span className="text-xs text-on-surface-variant">{ing.unit}</span>
                  )}
                  <span className="text-on-surface text-sm flex-1">{ing.name}</span>
                  {ing.prepNote && (
                    <span className="text-xs text-on-surface-variant italic">{ing.prepNote}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Nutrition */}
          {recipe.nutrition && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Nutrition per serving</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Calories', value: recipe.nutrition.calories, unit: 'kcal' },
                  { label: 'Protein', value: recipe.nutrition.protein, unit: 'g' },
                  { label: 'Carbs', value: recipe.nutrition.carbs, unit: 'g' },
                  { label: 'Fat', value: recipe.nutrition.fat, unit: 'g' },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="bg-surface-container-lowest rounded-xl p-3 shadow-card text-center">
                    <p className="font-headline font-bold text-lg text-on-surface">
                      {value != null ? Math.round(value) : '–'}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">{unit}</p>
                    <p className="text-[10px] text-on-surface-variant">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          {recipe.steps && recipe.steps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Method</p>
              <div className="space-y-3">
                {recipe.steps.map((step, i) => (
                  <div key={step.id ?? i} className="flex gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-card">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="font-headline font-bold text-xs text-on-primary">{i + 1}</span>
                    </div>
                    <p className="text-on-surface text-sm leading-relaxed">{step.instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {recipe.notes && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Notes</p>
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-card">
                <p className="text-on-surface text-sm leading-relaxed">{recipe.notes}</p>
              </div>
            </div>
          )}

          {/* Cook mode */}
          <button
            onClick={() => navigate(`/recipes/${id}/cook`)}
            className="w-full py-4 rounded-full bg-primary text-on-primary font-headline font-bold text-base shadow-fab flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
              cooking
            </span>
            Start cook mode
          </button>
        </div>
      </div>

      {/* Share link */}
      <BottomSheet open={showShare} onClose={() => setShowShare(false)} title="Share recipe" size="sm">
        <div className="space-y-4 py-2">
          {shareUrl && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container text-on-surface text-sm break-all">
                {shareUrl}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!') }}
                className="w-full py-3 rounded-full bg-primary text-on-primary font-headline font-bold"
              >
                Copy link
              </button>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Delete confirm */}
      <BottomSheet open={showDelete} onClose={() => setShowDelete(false)} title="Delete recipe?" size="sm">
        <div className="space-y-4 py-2">
          <p className="text-on-surface-variant text-sm">This will permanently delete "{recipe.title}".</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDelete(false)}
              className="flex-1 py-3 rounded-full bg-surface-container font-headline font-bold text-on-surface">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleteRecipe.isPending}
              className="flex-1 py-3 rounded-full bg-error text-on-error font-headline font-bold disabled:opacity-50">
              Delete
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

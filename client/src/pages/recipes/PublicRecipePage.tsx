import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../components/shared/Toast'
import type { Recipe } from '../../types'

function usePublicRecipeQuery(token: string | undefined) {
  return useQuery({
    queryKey: ['public-recipe', token],
    queryFn: () => api.get<{ recipe: Recipe }>(`/public/recipes/${token}`).then((r) => r.data.recipe),
    enabled: !!token,
    retry: false,
  })
}

export function PublicRecipePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { token: authToken } = useAuthStore()
  const { data: recipe, isLoading, isError } = usePublicRecipeQuery(token)

  const handleImport = async () => {
    if (!authToken) {
      navigate('/login')
      return
    }
    try {
      // Navigate to review page with the recipe data pre-filled
      navigate('/recipes/import/review', { state: { importData: recipe, fromPublic: true } })
    } catch {
      toast.error('Could not import recipe')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant text-sm">Loading recipe…</p>
        </div>
      </div>
    )
  }

  if (isError || !recipe) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-4">no_meals</span>
        <h1 className="font-headline font-bold text-xl text-on-surface mb-2">Recipe not found</h1>
        <p className="text-on-surface-variant text-sm">This link may have expired or the recipe was made private.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      {/* Hero */}
      {recipe.pictureUrl ? (
        <div className="h-56 relative">
          <img src={recipe.pictureUrl} alt={recipe.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="font-headline font-bold text-2xl text-white leading-tight">{recipe.title}</h1>
          </div>
        </div>
      ) : (
        <div className="px-6 pt-16 pb-4 bg-surface-container-low">
          <h1 className="font-headline font-bold text-2xl text-on-surface mt-4">{recipe.title}</h1>
        </div>
      )}

      <div className="px-6 py-6 space-y-6">
        {/* Meta */}
        <div className="flex gap-3 flex-wrap">
          {recipe.prepTime != null && (
            <div className="flex items-center gap-1.5 bg-surface-container-low rounded-full px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">schedule</span>
              <span className="text-xs font-medium text-on-surface-variant">Prep {recipe.prepTime}m</span>
            </div>
          )}
          {recipe.cookTime != null && (
            <div className="flex items-center gap-1.5 bg-surface-container-low rounded-full px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">local_fire_department</span>
              <span className="text-xs font-medium text-on-surface-variant">Cook {recipe.cookTime}m</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1.5 bg-surface-container-low rounded-full px-3 py-1.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">group</span>
              <span className="text-xs font-medium text-on-surface-variant">{recipe.servings} servings</span>
            </div>
          )}
        </div>

        {/* Ingredients */}
        {(recipe.ingredients?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Ingredients</p>
            <div className="space-y-2">
              {recipe.ingredients?.map((ing, i) => (
                <div key={i} className="flex gap-3 items-baseline">
                  <span className="text-sm font-bold text-primary min-w-[5rem]">
                    {ing.quantity != null ? `${ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(1)} ${ing.unit ?? ''}`.trim() : ing.unit ?? ''}
                  </span>
                  <span className="text-sm text-on-surface">{ing.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {(recipe.steps?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Method</p>
            <div className="space-y-4">
              {recipe.steps?.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-on-primary text-xs font-bold">{i + 1}</span>
                  </div>
                  <p className="text-sm text-on-surface leading-relaxed flex-1">{step.instruction}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div className="bg-surface-container-low rounded-2xl p-4">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Notes</p>
            <p className="text-sm text-on-surface leading-relaxed">{recipe.notes}</p>
          </div>
        )}
      </div>

      {/* Import FAB */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-surface via-surface/90 to-transparent">
        <button
          onClick={handleImport}
          className="w-full py-4 rounded-full bg-primary text-on-primary font-headline font-bold text-base shadow-fab flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Import to Mealio
        </button>
        {!authToken && (
          <p className="text-center text-xs text-on-surface-variant mt-2">You'll need to sign in first</p>
        )}
      </div>
    </div>
  )
}

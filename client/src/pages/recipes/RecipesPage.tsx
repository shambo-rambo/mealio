import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { EmptyState } from '../../components/shared/EmptyState'
import { RecipeCardSkeleton } from '../../components/shared/Skeleton'
import { useRecipesQuery, useCollectionsQuery } from '../../hooks/useRecipes'
import type { DietaryTag } from '../../types'
import { DIETARY_TAG_LABELS } from '../../types'

const DIET_TAGS: DietaryTag[] = ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_free']

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s}
          className={`material-symbols-outlined text-[14px] ${s <= Math.round(rating) ? 'text-yellow-400' : 'text-outline-variant'}`}
          style={{ fontVariationSettings: s <= Math.round(rating) ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}>
          star
        </span>
      ))}
    </div>
  )
}

const PLACEHOLDER_TONES = [
  'from-primary-container to-primary',
  'from-[#4f8a5b] to-[#2d6a43]',
  'from-[#8aa85f] to-[#5a7d3a]',
  'from-[#c98f4a] to-[#a5692b]',
  'from-[#5b8fa8] to-[#3a6a85]',
  'from-[#a86b6b] to-[#853f3f]',
]
function placeholderTone(title: string) {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PLACEHOLDER_TONES[h % PLACEHOLDER_TONES.length]
}

export function RecipesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<DietaryTag | null>(null)
  const [activeCollection, setActiveCollection] = useState<string | null>(null)

  const { data: recipes, isLoading } = useRecipesQuery({
    search: search || undefined,
    tag: activeTag ?? undefined,
    collection: activeCollection ?? undefined,
  })
  const { data: collections = [] } = useCollectionsQuery()

  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar
        title="Recipes"
        showAvatar
        right={
          <button
            onClick={() => navigate('/recipes/import')}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-fab"
          >
            <span className="material-symbols-outlined text-on-primary text-[20px]">add</span>
          </button>
        }
      />

      <div className="pt-20 px-6 mt-2 space-y-3">
        {/* Search */}
        <div className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-card border border-outline-variant/30">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 font-medium outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="material-symbols-outlined text-on-surface-variant text-[18px]">close</button>
          )}
        </div>

        {/* Dietary tag chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {DIET_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTag === tag
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {DIETARY_TAG_LABELS[tag]}
            </button>
          ))}
        </div>

        {/* Collection pills */}
        {collections.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(activeCollection === col.id ? null : col.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCollection === col.id
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {col.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="px-6 mt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <RecipeCardSkeleton key={i} />)}
          </div>
        ) : !recipes?.length ? (
          <EmptyState
            icon="restaurant_menu"
            title={search || activeTag ? 'No recipes found' : 'No recipes yet'}
            description={
              search || activeTag
                ? 'Try a different search or filter.'
                : 'Import your first recipe from a URL, photo, or text.'
            }
            action={
              !search && !activeTag
                ? { label: 'Import recipe', onClick: () => navigate('/recipes/import') }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                className="bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden text-left hover:shadow-card-md active:scale-[0.98] transition-all"
              >
                {recipe.pictureUrl ? (
                  <img src={recipe.pictureUrl} alt={recipe.title} className="w-full h-32 object-cover" />
                ) : (
                  <div className={`w-full h-32 bg-gradient-to-br ${placeholderTone(recipe.title)} flex items-center justify-center`}>
                    <span className="font-headline font-extrabold text-[44px] text-white/80 select-none">
                      {recipe.title.trim().charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="p-3">
                  <p className="font-headline font-bold text-sm text-on-surface leading-tight line-clamp-2">
                    {recipe.title}
                  </p>
                  {(recipe.prepTime || recipe.cookTime) && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      {[recipe.prepTime && `${recipe.prepTime}m prep`, recipe.cookTime && `${recipe.cookTime}m cook`]
                        .filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <StarDisplay rating={recipe.averageRating ?? null} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

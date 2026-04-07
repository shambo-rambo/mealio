import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRecipeQuery, scaleIngredients } from '../../hooks/useRecipes'

export function CookModePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: recipe } = useRecipeQuery(id ?? null)
  const [step, setStep] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    const acquire = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        } catch { /* wake lock not supported */ }
      }
    }
    acquire()
    return () => { wakeLockRef.current?.release() }
  }, [])

  if (!recipe) return null

  const steps = recipe.steps ?? []
  const current = steps[step]
  const progress = steps.length > 0 ? ((step + 1) / steps.length) * 100 : 0
  const scaled = scaleIngredients(recipe.ingredients ?? [], recipe.servings, recipe.servings)

  return (
    <div className="min-h-screen bg-on-surface text-surface flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-surface/20 flex-shrink-0">
        <div
          className="h-full bg-primary-fixed transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="material-symbols-outlined text-surface/70">
          close
        </button>
        <span className="font-headline font-bold text-surface/70 text-sm">
          Step {step + 1} of {steps.length}
        </span>
        <button
          onClick={() => setShowIngredients(!showIngredients)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/10 text-surface/70 text-xs font-bold"
        >
          <span className="material-symbols-outlined text-[16px]">list</span>
          Ingredients
        </button>
      </div>

      {/* Ingredients panel */}
      {showIngredients && (
        <div className="mx-6 mb-4 bg-surface/10 rounded-2xl p-4 flex-shrink-0">
          <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {scaled.map((ing, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-primary-fixed font-bold min-w-[4rem]">
                  {ing.scaled != null ? `${ing.scaled % 1 === 0 ? ing.scaled : ing.scaled.toFixed(1)} ${ing.unit ?? ''}`.trim() : ing.unit ?? '–'}
                </span>
                <span className="text-surface/80">{ing.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-8 shadow-fab">
          <span className="font-headline font-bold text-on-primary text-2xl">{step + 1}</span>
        </div>
        <p className="font-headline font-bold text-2xl text-surface leading-relaxed">
          {current?.instruction ?? 'Done!'}
        </p>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-12 flex gap-4 flex-shrink-0">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex-1 py-4 rounded-full bg-surface/10 text-surface font-headline font-bold disabled:opacity-30"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex-1 py-4 rounded-full bg-primary text-on-primary font-headline font-bold shadow-fab"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-4 rounded-full bg-primary-fixed text-on-primary font-headline font-bold shadow-fab"
          >
            Done!
          </button>
        )}
      </div>
    </div>
  )
}

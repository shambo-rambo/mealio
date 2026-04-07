import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { toast } from '../../components/shared/Toast'
import { useImportRecipeMutation } from '../../hooks/useRecipes'

type ImportTab = 'url' | 'text' | 'photo'

export function RecipeImportPage() {
  const navigate = useNavigate()
  const importRecipe = useImportRecipeMutation()
  const [tab, setTab] = useState<ImportTab>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async (type: ImportTab, payload: string, mediaType?: string) => {
    try {
      const result = await importRecipe.mutateAsync({ type, payload, mediaType })
      navigate('/recipes/review', { state: { importResult: result } })
    } catch {
      toast.error('Import failed. Please check the URL or try again.')
    }
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1]
      await handleImport('photo', base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const tabs: { id: ImportTab; icon: string; label: string }[] = [
    { id: 'url', icon: 'link', label: 'URL' },
    { id: 'photo', icon: 'photo_camera', label: 'Photo' },
    { id: 'text', icon: 'article', label: 'Paste' },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <TopBar title="Import recipe" showBack />

      <div className="pt-20 px-6 mt-4">
        {/* Tab switcher */}
        <div className="flex bg-surface-container-low p-1.5 rounded-full mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all ${
                tab === t.id ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* URL tab */}
        {tab === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Recipe URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <p className="text-xs text-on-surface-variant">
              Paste any recipe URL. Claude will extract all the details automatically.
            </p>
            <button
              onClick={() => handleImport('url', url)}
              disabled={!url.trim() || importRecipe.isPending}
              className="w-full py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold shadow-fab disabled:opacity-50"
            >
              {importRecipe.isPending ? 'Importing…' : 'Import from URL'}
            </button>
          </div>
        )}

        {/* Photo tab */}
        {tab === 'photo' && (
          <div className="space-y-4">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importRecipe.isPending}
              className="w-full h-52 border-2 border-dashed border-outline-variant rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary transition-colors disabled:opacity-50"
            >
              {importRecipe.isPending ? (
                <>
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-on-surface-variant text-sm">Analysing recipe…</p>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}>
                    add_photo_alternate
                  </span>
                  <p className="font-headline font-bold text-on-surface-variant">Tap to take or choose photo</p>
                  <p className="text-xs text-on-surface-variant">Cookbook, magazine, or handwritten card</p>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </div>
        )}

        {/* Text tab */}
        {tab === 'text' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Paste recipe text</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your recipe here…"
                rows={10}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <button
              onClick={() => handleImport('text', text)}
              disabled={!text.trim() || importRecipe.isPending}
              className="w-full py-3.5 rounded-full bg-primary text-on-primary font-headline font-bold shadow-fab disabled:opacity-50"
            >
              {importRecipe.isPending ? 'Importing…' : 'Import from text'}
            </button>
          </div>
        )}

        {/* Also create manually */}
        <div className="mt-8 text-center">
          <p className="text-sm text-on-surface-variant">
            Prefer to type it yourself?{' '}
            <button onClick={() => navigate('/recipes/review', { state: { importResult: null } })}
              className="text-primary font-semibold">
              Create manually
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export type FeatureId = 'streaks' | 'planner' | 'recipes' | 'shopping'

export interface FeatureDef {
  id: FeatureId
  to: string
  icon: string
  label: string
  description: string
}

/** Every switchable area of the app. The array order is the default nav order. */
export const FEATURES: FeatureDef[] = [
  { id: 'streaks', to: '/streaks', icon: 'local_fire_department', label: 'Streaks', description: 'Daily goals, check-ins and streaks' },
  { id: 'planner', to: '/planner', icon: 'calendar_today', label: 'Meal Plan', description: 'Plan meals, snacks and sides for each day' },
  { id: 'recipes', to: '/recipes', icon: 'restaurant_menu', label: 'Recipes', description: 'Save, import and cook your recipes' },
  { id: 'shopping', to: '/shopping', icon: 'checklist', label: 'Lists', description: 'Shopping lists, to-dos, packing and more' },
]

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, FeatureDef>
export const DEFAULT_NAV_ORDER: FeatureId[] = FEATURES.map((f) => f.id)

/** Features that start switched off until the user turns them on in Settings. */
export const DEFAULT_HIDDEN: FeatureId[] = ['streaks']

/** Which feature a URL path belongs to, if any. */
export function featureForPath(pathname: string): FeatureDef | undefined {
  return FEATURES.find((f) => pathname === f.to || pathname.startsWith(f.to + '/'))
}

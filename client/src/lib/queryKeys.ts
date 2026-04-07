export const queryKeys = {
  // Auth
  me: () => ['me'] as const,

  // Family
  family: () => ['family'] as const,
  stores: () => ['stores'] as const,

  // Shopping
  lists: {
    all: () => ['lists'] as const,
    detail: (id: string) => ['lists', id] as const,
    items: (listId: string) => ['lists', listId, 'items'] as const,
    suggestions: (familyId: string, query: string) =>
      ['suggestions', familyId, query] as const,
  },

  // Recipes
  recipes: {
    all: (filters?: Record<string, string>) => ['recipes', filters] as const,
    detail: (id: string) => ['recipes', id] as const,
    public: (token: string) => ['recipes', 'public', token] as const,
  },

  // Collections
  collections: () => ['collections'] as const,

  // Meal plan
  mealPlan: (start: string, end: string) => ['meal-plan', start, end] as const,

  // Item history (autocomplete)
  itemHistory: (query: string) => ['item-history', query] as const,
}

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, AppLayout } from './components/layout/AppLayout'
import { useAuthStore } from './store/authStore'
import { useRealtime } from './hooks/useRealtime'

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))

// Family setup (post-register, no family yet)
const FamilySetupPage = lazy(() => import('./pages/family/FamilySetupPage').then((m) => ({ default: m.FamilySetupPage })))

// Main app pages
const PlannerPage = lazy(() => import('./pages/planner/PlannerPage').then((m) => ({ default: m.PlannerPage })))
const RecipesPage = lazy(() => import('./pages/recipes/RecipesPage').then((m) => ({ default: m.RecipesPage })))
const RecipeDetailPage = lazy(() => import('./pages/recipes/RecipeDetailPage').then((m) => ({ default: m.RecipeDetailPage })))
const RecipeImportPage = lazy(() => import('./pages/recipes/RecipeImportPage').then((m) => ({ default: m.RecipeImportPage })))
const RecipeReviewPage = lazy(() => import('./pages/recipes/RecipeReviewPage').then((m) => ({ default: m.RecipeReviewPage })))
const CookModePage = lazy(() => import('./pages/recipes/CookModePage').then((m) => ({ default: m.CookModePage })))
const RecipeEditPage = lazy(() => import('./pages/recipes/RecipeEditPage').then((m) => ({ default: m.RecipeEditPage })))
const ListsPage = lazy(() => import('./pages/lists/ListsPage').then((m) => ({ default: m.ListsPage })))
const ListDetailPage = lazy(() => import('./pages/lists/ListDetailPage').then((m) => ({ default: m.ListDetailPage })))
const FamilyPage = lazy(() => import('./pages/family/FamilyPage').then((m) => ({ default: m.FamilyPage })))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const StoresPage = lazy(() => import('./pages/stores/StoresPage').then((m) => ({ default: m.StoresPage })))

// Public pages (no auth required)
const QuickAddPage = lazy(() => import('./pages/lists/QuickAddPage').then((m) => ({ default: m.QuickAddPage })))
const PublicRecipePage = lazy(() => import('./pages/recipes/PublicRecipePage').then((m) => ({ default: m.PublicRecipePage })))
const JoinPage = lazy(() => import('./pages/family/JoinPage').then((m) => ({ default: m.JoinPage })))

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  )
}

export default function App() {
  const token = useAuthStore((s) => s.token)
  useRealtime(token)

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/list/:id/quick-add" element={<QuickAddPage />} />
        <Route path="/r/:token" element={<PublicRecipePage />} />

        {/* Family setup — authenticated but no family yet */}
        <Route element={<ProtectedRoute />}>
          <Route path="/setup" element={<FamilySetupPage />} />
        </Route>

        {/* Cook mode / Edit — full screen, no bottom nav */}
        <Route element={<ProtectedRoute />}>
          <Route path="/recipes/:id/cook" element={<CookModePage />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditPage />} />
        </Route>

        {/* Main app — authenticated + has family */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/planner" replace />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/import" element={<RecipeImportPage />} />
            <Route path="/recipes/import/review" element={<RecipeReviewPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/shopping" element={<ListsPage />} />
            <Route path="/shopping/:id" element={<ListDetailPage />} />
            <Route path="/family" element={<FamilyPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/stores" element={<StoresPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/planner" replace />} />
      </Routes>
    </Suspense>
  )
}

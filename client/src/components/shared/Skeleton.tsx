interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-container-high rounded-lg animate-pulse ${className}`}
    />
  )
}

export function ListItemSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-card p-4 flex items-center gap-4">
      <Skeleton className="w-6 h-6 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-8 h-7 rounded-full flex-shrink-0" />
    </div>
  )
}

export function RecipeCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-card overflow-hidden">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function CategorySkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="space-y-0">
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </div>
  )
}

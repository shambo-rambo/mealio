export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center mb-5 bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-fab"
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: size * 0.5, fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 40" }}
      >
        restaurant_menu
      </span>
    </div>
  )
}

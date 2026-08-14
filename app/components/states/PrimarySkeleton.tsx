/** Mantiene la forma del resultado mientras se resuelve el código postal. */
export default function PrimarySkeleton() {
  return (
    <div
      className="grid gap-6 rounded-2xl bg-ink-900/70 p-6 sm:grid-cols-[1fr_1.15fr] sm:items-center sm:gap-8 sm:p-8"
      aria-hidden="true"
    >
      <div className="space-y-6">
        <div className="skeleton h-14 w-60 rounded-lg sm:h-16" />
        <div className="space-y-2">
          <div className="skeleton h-6 w-48 rounded" />
          <div className="skeleton h-5 w-60 rounded" />
        </div>
      </div>

      <div className="skeleton h-56 w-full rounded-xl sm:h-72" />
    </div>
  );
}

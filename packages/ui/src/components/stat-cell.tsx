import { cn } from "../lib/utils"
import { Skeleton } from "./skeleton"

export interface StatCellProps {
  label: string
  value: string | null
  loading?: boolean
  highlight?: boolean
  danger?: boolean
  /** Hiện khi value null và không loading (default "—") */
  fallback?: string
  className?: string
}

export function StatCell({ label, value, loading = false, highlight = false, danger = false, fallback = "—", className }: StatCellProps) {
  return (
    <div className={cn("space-y-0.5 px-3 py-2.5", className)}>
      <p className="text-[11px] leading-tight text-muted-foreground-subtle">{label}</p>
      {loading && !value ? (
        <Skeleton className="mt-1 h-5 w-20" />
      ) : (
        <p
          className={cn(
            "text-sm font-bold leading-tight",
            danger ? "text-destructive" : highlight ? "text-primary-light" : "text-foreground"
          )}
        >
          {value ?? fallback}
        </p>
      )}
    </div>
  )
}

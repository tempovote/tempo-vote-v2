import { cn } from "../lib/utils"

/** Sliver tối thiểu (%) để segment > 0 vẫn nhìn thấy được (PR #110). */
export const MIN_SLIVER_PERCENT = 0.5
/** Ngưỡng % để hiện label bên trong segment (bản gốc: yesPercent > 12). */
export const LABEL_MIN_PERCENT = 12

/** Width render của segment: 0 giữ 0, giá trị dương nhỏ được nâng lên sliver. */
export function voteBarSegmentWidth(value: number): number {
  if (value <= 0) return 0
  return Math.max(value, MIN_SLIVER_PERCENT)
}

export type VoteBarSegmentColor = "yes" | "no" | "abstain" | "not-voted"

export interface VoteBarSegment {
  /** Phần trăm 0–100 */
  value: number
  color: VoteBarSegmentColor
  /** Hiện bên trong segment khi value > LABEL_MIN_PERCENT (vd "67%") */
  label?: string
}

const SEGMENT_CLS: Record<VoteBarSegmentColor, string> = {
  yes: "bg-vote-yes",
  no: "bg-vote-no",
  abstain: "bg-vote-abstain",
  "not-voted": "bg-vote-abstain/20",
}

export interface VoteBarProps {
  segments: VoteBarSegment[]
  /** Vạch ngưỡng 0–100; null/undefined = không hiện */
  threshold?: number | null
  className?: string
}

export function VoteBar({ segments, threshold, className }: VoteBarProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="flex h-3.5 overflow-hidden rounded-md bg-popover">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center overflow-hidden transition-[width] duration-[600ms]",
              SEGMENT_CLS[seg.color]
            )}
            style={{ width: `${voteBarSegmentWidth(seg.value)}%` }}
          >
            {seg.label !== undefined && seg.value > LABEL_MIN_PERCENT && (
              <span className="select-none px-1.5 text-[10px] font-bold leading-none text-white drop-shadow-sm">
                {seg.label}
              </span>
            )}
          </div>
        ))}
      </div>
      {threshold != null && (
        <div
          className="absolute -bottom-0.5 -top-0.5 z-10 w-0.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${threshold}%` }}
        />
      )}
    </div>
  )
}

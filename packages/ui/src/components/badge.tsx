import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

export const badgeVariants = cva(
  "inline-flex items-center rounded-badge border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary-light",
        outline: "border-border bg-transparent text-muted-foreground",
        "status-active": "border-status-active/30 bg-status-active/15 text-status-active",
        "status-ratified": "border-status-ratified/30 bg-status-ratified/15 text-status-ratified",
        "status-expired": "border-status-expired/30 bg-status-expired/15 text-status-expired",
        "status-enacted": "border-status-enacted/30 bg-status-enacted/15 text-status-enacted",
        "status-dropped": "border-status-dropped/30 bg-status-dropped/15 text-status-dropped",
        "risk-critical": "border-risk-critical/30 bg-risk-critical/15 text-risk-critical",
        "risk-major": "border-risk-major/30 bg-risk-major/15 text-risk-major",
        "risk-medium": "border-risk-medium/30 bg-risk-medium/15 text-risk-medium",
        "risk-minor": "border-risk-minor/30 bg-risk-minor/15 text-risk-minor",
        "risk-unknown": "border-risk-unknown/30 bg-risk-unknown/15 text-risk-unknown",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

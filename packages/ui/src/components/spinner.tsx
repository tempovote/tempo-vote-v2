import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const spinnerVariants = cva(
  "inline-block shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary [animation-duration:0.7s]",
  {
    variants: {
      size: { sm: "size-4", default: "size-5", lg: "size-8" },
    },
    defaultVariants: { size: "default" },
  }
)

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
  /** Accessible label; mặc định "Loading" */
  label?: string
}

export function Spinner({ className, size, label = "Loading" }: SpinnerProps) {
  return <span role="status" aria-label={label} className={cn(spinnerVariants({ size }), className)} />
}

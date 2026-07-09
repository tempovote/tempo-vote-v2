import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const alertVariants = cva("flex gap-3 rounded-card border px-4 py-3 text-sm text-muted-foreground", {
  variants: {
    variant: {
      default: "items-center border-primary/20 bg-primary/8",
      success: "items-center border-success/20 bg-success/8",
      warning: "flex-col gap-1 border-warning/20 bg-warning/8",
      destructive: "items-center border-destructive/20 bg-destructive/8",
    },
  },
  defaultVariants: { variant: "default" },
})

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-semibold text-foreground", className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

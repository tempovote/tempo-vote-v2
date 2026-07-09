import { forwardRef } from "react"
import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const cardVariants = cva("rounded-card border bg-card p-6", {
  variants: {
    variant: {
      default: "border-border transition-all hover:border-ring hover:shadow-glow",
      static: "border-border",
      accent: "border-primary/30",
    },
  },
  defaultVariants: { variant: "static" },
})

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
))
Card.displayName = "Card"

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 pb-4", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-snug text-foreground", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />
)
CardContent.displayName = "CardContent"

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 pt-4", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

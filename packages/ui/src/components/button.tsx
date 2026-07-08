import { forwardRef } from "react"
import type { ButtonHTMLAttributes } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-button font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary to-accent-purple text-white hover:-translate-y-px hover:opacity-90 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)]",
        outline:
          "border border-primary bg-transparent text-primary-light hover:border-primary-light hover:bg-primary/10",
        success: "bg-success text-white hover:bg-success-dark",
        destructive: "bg-destructive text-white hover:bg-destructive-dark",
        ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "bg-transparent text-primary-light underline-offset-4 hover:underline",
      },
      size: {
        default: "px-6 py-2.5 text-sm",
        sm: "px-4 py-2 text-xs",
        lg: "px-8 py-3 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  }
)
Button.displayName = "Button"

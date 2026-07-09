import { forwardRef } from "react"
import type { InputHTMLAttributes } from "react"
import { cn } from "../lib/utils"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-input border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted-foreground-subtle",
        "focus:border-primary focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

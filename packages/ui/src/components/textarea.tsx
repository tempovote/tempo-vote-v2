import { forwardRef } from "react"
import type { TextareaHTMLAttributes } from "react"
import { cn } from "../lib/utils"

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full rounded-input border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted-foreground-subtle",
        "focus:border-primary focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

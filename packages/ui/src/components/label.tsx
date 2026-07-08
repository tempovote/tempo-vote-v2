"use client"

import { forwardRef } from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

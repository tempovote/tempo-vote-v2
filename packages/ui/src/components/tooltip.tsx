"use client"

import { forwardRef } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-badge border border-border bg-popover px-3 py-1.5 text-xs text-foreground shadow-card animate-fade-in",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = "TooltipContent"

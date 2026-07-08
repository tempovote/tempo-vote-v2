"use client"

import { forwardRef } from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex w-full items-center gap-1 border-b border-border-subtle", className)}
    {...props}
  />
))
TabsList.displayName = "TabsList"

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "-mb-px cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors",
      "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
      "data-[state=active]:border-primary data-[state=active]:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("pt-4 outline-none", className)} {...props} />
))
TabsContent.displayName = "TabsContent"

"use client"

import { forwardRef } from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react"
import { cn } from "../lib/utils"
import { buttonVariants } from "./button"

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

export const AlertDialogContent = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 data-[state=open]:animate-fade-in" />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2",
        "rounded-2xl border border-border bg-secondary p-6",
        "shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(99,102,241,0.08)]",
        "data-[state=open]:animate-slide-up",
        className
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
))
AlertDialogContent.displayName = "AlertDialogContent"

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 pb-4", className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-end gap-3 pt-4", className)} {...props} />
}

export const AlertDialogTitle = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold leading-snug text-foreground", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogAction = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Action>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants({}), className)} {...props} />
))
AlertDialogAction.displayName = "AlertDialogAction"

export const AlertDialogCancel = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Cancel>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "ghost" }), className)}
    {...props}
  />
))
AlertDialogCancel.displayName = "AlertDialogCancel"

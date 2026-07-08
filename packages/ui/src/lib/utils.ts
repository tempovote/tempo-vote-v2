import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge class names; xung đột Tailwind utilities thì class sau thắng. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

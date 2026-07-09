import type { HTMLAttributes } from "react"
import { cn } from "../lib/utils"
import { formatAda } from "../lib/format"

export interface AdaAmountProps extends HTMLAttributes<HTMLSpanElement> {
  lovelace: number
  symbol?: "₳" | "ADA"
}

/** Hiển thị lovelace dạng ADA gọn (1.23B · 595.01M · 1.5K) + ký hiệu. */
export function AdaAmount({ lovelace, symbol = "₳", className, ...props }: AdaAmountProps) {
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {formatAda(lovelace)} {symbol}
    </span>
  )
}

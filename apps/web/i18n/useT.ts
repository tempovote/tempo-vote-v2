"use client"

import { useCallback } from "react"
import type { Locale } from "@/store/locale"
import { useLocaleContext } from "./LocaleProvider"
import en, { type Messages } from "./messages/en"
import ja from "./messages/ja"
import vi from "./messages/vi"

const DICTS: Record<Locale, Messages> = { en, ja, vi }

/** Dot-path lookup into a dictionary; returns undefined if missing or not a string. */
function lookup(dict: Messages, key: string): string | undefined {
  let cur: unknown = dict
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof cur === "string" ? cur : undefined
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string

/**
 * Translation hook. `t("nav.home")`, `t("home.drepBanner.selfDelegate.desc", { amount })`.
 * Falls back: active locale → English → the key itself (surfaces missing keys in dev).
 */
export function useT(): TFunc {
  const { locale } = useLocaleContext()
  return useCallback(
    (key, vars) => {
      const raw = lookup(DICTS[locale], key) ?? lookup(en, key) ?? key
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
    },
    [locale],
  )
}

/** For the language switcher: current locale + setter. */
export function useLocale() {
  return useLocaleContext()
}

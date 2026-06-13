import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import { ExtensionErrorFilter } from "@/components/ExtensionErrorFilter"
import LocaleProvider from "@/i18n/LocaleProvider"
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/store/locale"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Tempo — Cardano Governance for DReps",
  description:
    "Governance tool for DReps on Cardano. Vote on governance actions, manage your DRep profile, and engage with your community.",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve locale from cookie so SSR renders in the right language (no flash).
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const initialLocale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  return (
    <html lang={initialLocale} className={inter.variable} suppressHydrationWarning>
      <body className="bg-bg-primary text-text-primary min-h-screen flex flex-col" suppressHydrationWarning>
        <ExtensionErrorFilter />
        <LocaleProvider initialLocale={initialLocale}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  )
}

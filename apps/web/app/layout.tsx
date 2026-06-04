import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="bg-bg-primary text-text-primary min-h-screen flex flex-col" suppressHydrationWarning>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}

"use client"

import { useState } from "react"
import { useT } from "@/i18n/useT"

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-success mt-0.5">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <polyline points="8,12 11,15 16,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-accent-light mt-0.5">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
)

const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    <path d="M16 3H8l-2 4h12l-2-4z"/>
    <circle cx="17" cy="13" r="1" fill="currentColor" />
  </svg>
)

const VoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)

const DRepIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const GovIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M9 21V9"/>
  </svg>
)

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const PollIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 mt-3 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-text-secondary">
      <InfoIcon />
      <span>{children}</span>
    </div>
  )
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light text-sm font-bold shrink-0">
          {num}
        </div>
        <div className="w-px flex-1 bg-border-subtle mt-2" />
      </div>
      <div className="pb-6 flex-1">
        <h4 className="font-semibold text-text-primary mb-1">{title}</h4>
        <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

export default function UserGuidesPage() {
  const t = useT()

  const SECTIONS = [
    {
      id: "wallet",
      icon: <WalletIcon />,
      title: t("userGuides.s1Title"),
      shortTitle: t("userGuides.s1Short"),
      steps: [
        {
          title: t("userGuides.s1s1Title"),
          body: (
            <>
              <p>{t("userGuides.s1s1Body")}</p>
              <ul className="mt-2 space-y-1">
                {["Eternl", "Lace", "Yoroi", "Flint", "NuFi", "GeroWallet"].map(w => (
                  <li key={w} className="flex items-center gap-2"><CheckIcon />{w}</li>
                ))}
              </ul>
              <Tip>{t("userGuides.s1s1Tip")}</Tip>
            </>
          ),
        },
        {
          title: t("userGuides.s1s2Title"),
          body: (
            <>
              <p>{t("userGuides.s1s2Body")}</p>
              <Tip>{t("userGuides.s1s2Tip")}</Tip>
            </>
          ),
        },
        {
          title: t("userGuides.s1s3Title"),
          body: <p>{t("userGuides.s1s3Body")}</p>,
        },
      ],
    },
    {
      id: "drep",
      icon: <DRepIcon />,
      title: t("userGuides.s2Title"),
      shortTitle: t("userGuides.s2Short"),
      steps: [
        {
          title: t("userGuides.s2s1Title"),
          body: (
            <>
              <p>{t("userGuides.s2s1Body")}</p>
              <ul className="mt-2 space-y-1">
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Voting Power</strong>: {t("userGuides.s2s1Item1")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Delegators</strong>: {t("userGuides.s2s1Item2")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s2s1Item3")}</span></li>
              </ul>
            </>
          ),
        },
        {
          title: t("userGuides.s2s2Title"),
          body: (
            <>
              <p>{t("userGuides.s2s2Body")}</p>
              <ul className="mt-2 space-y-1">
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Delegators</strong>: {t("userGuides.s2s2Item1")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Voting Power</strong>: {t("userGuides.s2s2Item2")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Whale Delegators</strong>: {t("userGuides.s2s2Item3")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">VP Change</strong>: {t("userGuides.s2s2Item4")}</span></li>
              </ul>
            </>
          ),
        },
        {
          title: t("userGuides.s2s3Title"),
          body: (
            <>
              <p>{t("userGuides.s2s3Body")}</p>
              <Tip>{t("userGuides.s2s3Tip")}</Tip>
            </>
          ),
        },
      ],
    },
    {
      id: "governance",
      icon: <GovIcon />,
      title: t("userGuides.s3Title"),
      shortTitle: t("userGuides.s3Short"),
      steps: [
        {
          title: t("userGuides.s3s1Title"),
          body: (
            <>
              <p>{t("userGuides.s3s1Body")}</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {[
                  ["ParameterChange", t("userGuides.s3s1GA1")],
                  ["HardForkInitiation", t("userGuides.s3s1GA2")],
                  ["TreasuryWithdrawals", t("userGuides.s3s1GA3")],
                  ["NoConfidence", t("userGuides.s3s1GA4")],
                  ["UpdateCommittee", t("userGuides.s3s1GA5")],
                  ["NewConstitution", t("userGuides.s3s1GA6")],
                  ["InfoAction", t("userGuides.s3s1GA7")],
                ].map(([name, desc]) => (
                  <div key={name} className="flex gap-2 text-sm">
                    <CheckIcon />
                    <span><strong className="text-text-primary">{name}</strong>: {desc}</span>
                  </div>
                ))}
              </div>
            </>
          ),
        },
        {
          title: t("userGuides.s3s2Title"),
          body: (
            <>
              <p>{t("userGuides.s3s2Body")}</p>
              <ul className="mt-2 space-y-1">
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s3s2Item1")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s3s2Item2")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s3s2Item3")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s3s2Item4")}</span></li>
              </ul>
            </>
          ),
        },
        {
          title: t("userGuides.s3s3Title"),
          body: (
            <>
              <p>{t("userGuides.s3s3Body")}</p>
              <Tip>{t("userGuides.s3s3Tip")}</Tip>
            </>
          ),
        },
      ],
    },
    {
      id: "polls",
      icon: <PollIcon />,
      title: t("userGuides.s4Title"),
      shortTitle: t("userGuides.s4Short"),
      steps: [
        {
          title: t("userGuides.s4s1Title"),
          body: <p>{t("userGuides.s4s1Body")}</p>,
        },
        {
          title: t("userGuides.s4s2Title"),
          body: (
            <>
              <p>{t("userGuides.s4s2Body")}</p>
              <Tip>{t("userGuides.s4s2Tip")}</Tip>
            </>
          ),
        },
      ],
    },
    {
      id: "treasury",
      icon: <ChartIcon />,
      title: t("userGuides.s5Title"),
      shortTitle: t("userGuides.s5Short"),
      steps: [
        {
          title: t("userGuides.s5s1Title"),
          body: <p>{t("userGuides.s5s1Body")}</p>,
        },
        {
          title: t("userGuides.s5s2Title"),
          body: (
            <>
              <p>{t("userGuides.s5s2Body")}</p>
              <ul className="mt-2 space-y-1">
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Avg TX Fees / Epoch</strong>: {t("userGuides.s5s2Item1")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Treasury Withdrawal / Year</strong>: {t("userGuides.s5s2Item2")}</span></li>
              </ul>
              <p className="mt-2">{t("userGuides.s5s2Desc")}</p>
              <Tip>{t("userGuides.s5s2Tip")}</Tip>
            </>
          ),
        },
      ],
    },
    {
      id: "ranking",
      icon: <VoteIcon />,
      title: t("userGuides.s6Title"),
      shortTitle: t("userGuides.s6Short"),
      steps: [
        {
          title: t("userGuides.s6s1Title"),
          body: <p>{t("userGuides.s6s1Body")}</p>,
        },
        {
          title: t("userGuides.s6s2Title"),
          body: (
            <>
              <p>{t("userGuides.s6s2Body")}</p>
              <ul className="mt-2 space-y-1">
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s6s2Item1")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s6s2Item2")}</span></li>
                <li className="flex gap-2"><CheckIcon /><span>{t("userGuides.s6s2Item3")}</span></li>
              </ul>
            </>
          ),
        },
      ],
    },
  ]

  const [active, setActive] = useState(SECTIONS[0]!.id)
  const section = SECTIONS.find(s => s.id === active)!

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold gradient-text">{t("userGuides.title")}</h1>
        <p className="text-text-secondary text-sm">
          {t("userGuides.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-56 shrink-0 sticky top-4">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                active === s.id
                  ? "bg-accent/15 border border-accent/30 text-accent-light font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              }`}
            >
              <span className={active === s.id ? "text-accent-light" : "text-text-muted"}>{s.icon}</span>
              {s.title}
            </button>
          ))}
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden w-full">
          <div className="flex gap-1 overflow-x-auto scrollbar-none bg-bg-secondary rounded-xl p-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  active === s.id
                    ? "bg-bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span className="shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">{s.icon}</span>
                {s.shortTitle}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="card-static space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent-light">
                {section.icon}
              </div>
              <h2 className="text-lg font-bold">{section.title}</h2>
            </div>

            <div>
              {section.steps.map((step, i) => (
                <Step key={i} num={i + 1} title={step.title}>
                  {step.body}
                </Step>
              ))}
            </div>
          </div>

          {/* Quick nav bottom */}
          <div className="flex justify-between mt-4 text-sm">
            {(() => {
              const idx = SECTIONS.findIndex(s => s.id === active)
              const prev = idx > 0 ? SECTIONS[idx - 1] : undefined
              const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : undefined
              return (
                <>
                  {prev && (
                    <button
                      onClick={() => setActive(prev.id)}
                      className="flex items-center gap-1.5 text-text-secondary hover:text-accent-light transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                      {t("userGuides.navPrev")}
                    </button>
                  )}
                  {next && (
                    <button
                      onClick={() => setActive(next.id)}
                      className="ml-auto flex items-center gap-1.5 text-text-secondary hover:text-accent-light transition-colors"
                    >
                      {t("userGuides.navNext")}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </main>
      </div>
    </div>
  )
}

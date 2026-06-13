import React from "react"
import Link from "next/link"

const ExternalLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="text-accent-light hover:text-accent underline underline-offset-2 transition-colors">
    {children}
  </a>
)

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
      <span className="w-1 h-5 rounded-full bg-accent inline-block" />
      {children}
    </h2>
  )
}

const TECH_STACK = [
  {
    layer: "Frontend",
    color: "text-accent-light",
    bg: "bg-accent/10",
    border: "border-accent/20",
    items: ["Next.js 15 (App Router)", "TypeScript (strict)", "Tailwind CSS v4", "Recharts", "Turborepo + pnpm"],
  },
  {
    layer: "Backend",
    color: "text-accent-cyan",
    bg: "bg-accent-cyan/10",
    border: "border-accent-cyan/20",
    items: ["Kotlin + Ktor 3.x", "Kotlin Exposed ORM", "Caffeine Cache", "Flyway Migrations", "Gradle (Kotlin DSL)"],
  },
  {
    layer: "Cardano",
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
    border: "border-accent-purple/20",
    items: ["cardano-node (Preprod + Mainnet)", "Ogmios 6.x (WebSocket)", "Kupo (UTxO indexer)", "cardano-client-lib 0.7", "CIP-30 / CIP-95"],
  },
  {
    layer: "Database",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    items: ["PostgreSQL 16", "HikariCP connection pool", "Flyway schema versioning"],
  },
]

const GOV_ROLES = [
  {
    role: "DRep",
    icon: "🏛️",
    desc: "Delegated Representative — đại diện bỏ phiếu được cộng đồng Ada holder ủy quyền. DRep bỏ phiếu on-chain cho Governance Action thay mặt những người đã delegate voting power.",
  },
  {
    role: "SPO",
    icon: "⛏️",
    desc: "Stake Pool Operator — vận hành pool, đại diện cho cả sức mạnh kỹ thuật lẫn kinh tế. SPO có voting weight riêng trong một số loại GA (đặc biệt HardForkInitiation).",
  },
  {
    role: "Constitutional Committee",
    icon: "⚖️",
    desc: "Ủy ban Hiến pháp — kiểm tra tính hợp hiến của Governance Action. Nếu CC phủ quyết, GA không được thông qua dù DRep + SPO đồng thuận.",
  },
]

const LINKS = [
  { label: "Cardano Forum", href: "https://forum.cardano.org", desc: "Thảo luận quản trị cộng đồng" },
  { label: "Gov Tool", href: "https://gov.tools", desc: "Công cụ quản trị chính thức của IOG" },
  { label: "Cardano Constitution", href: "https://constitution.gov.tools", desc: "Hiến pháp Cardano on-chain" },
  { label: "CIP-1694", href: "https://github.com/cardano-foundation/CIPs/blob/master/CIP-1694/README.md", desc: "Đặc tả kỹ thuật Conway governance" },
]

export default function AboutPage() {
  return (
    <div className="page-container space-y-10 animate-fade-in">

      {/* Hero */}
      <section className="card-accent text-center space-y-4 py-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent-light text-xs font-medium mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
          Cardano Conway Era
        </div>
        <h1 className="text-3xl font-bold gradient-text">Tempo.Vote</h1>
        <p className="text-text-secondary max-w-xl mx-auto leading-relaxed text-sm">
          Nền tảng quản trị Cardano thế hệ mới — giúp DRep, cộng đồng và Ada holder
          tham gia hiệu quả vào quá trình ra quyết định on-chain của Cardano.
        </p>
        <div className="flex justify-center gap-3 flex-wrap pt-2">
          <Link href="/dreps" className="btn-primary text-sm px-4 py-2 rounded-lg">
            Khám phá DReps
          </Link>
          <Link href="/governance-actions" className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors text-sm">
            Governance Actions
          </Link>
        </div>
      </section>

      {/* Mission */}
      <section className="animate-slide-up">
        <SectionTitle>Sứ mệnh</SectionTitle>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: "🗳️",
              title: "Minh bạch",
              desc: "Mọi dữ liệu đều lấy trực tiếp từ on-chain qua Ogmios và Kupo — không qua Blockfrost, không trung gian tập trung.",
            },
            {
              icon: "🤝",
              title: "Tiếp cận",
              desc: "Giúp Ada holder dễ dàng tìm DRep phù hợp và hiểu tác động của từng Governance Action trước khi ủy quyền.",
            },
            {
              icon: "🔒",
              title: "An toàn",
              desc: "Private key không bao giờ rời khỏi ví. Mọi transaction đều được build server-side và ký hoàn toàn client-side bởi ví người dùng.",
            },
          ].map(item => (
            <div key={item.title} className="card-static space-y-2">
              <div className="text-2xl">{item.icon}</div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cardano Governance */}
      <section className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <SectionTitle>Quản trị Cardano (Conway Era)</SectionTitle>
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          Từ hard fork Chang (2024), Cardano chuyển sang mô hình quản trị phi tập trung theo{" "}
          <ExternalLink href="https://github.com/cardano-foundation/CIPs/blob/master/CIP-1694/README.md">CIP-1694</ExternalLink>.
          Ba lực lượng quyết định cùng nhau:
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {GOV_ROLES.map(item => (
            <div key={item.role} className="card-static space-y-2">
              <div className="text-2xl">{item.icon}</div>
              <h3 className="font-semibold">{item.role}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="card-static mt-4 text-center space-y-2 border border-warning/20">
          <div className="flex justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-warning">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="17" r="1" fill="currentColor"/>
            </svg>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            Để một Governance Action được thông qua, cần đạt ngưỡng đồng thuận từ cả DRep <strong className="text-text-primary">và</strong> SPO (tùy loại GA). Constitutional Committee có quyền phủ quyết nếu GA vi hiến.
          </p>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
        <SectionTitle>Kiến trúc kỹ thuật</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          {TECH_STACK.map(layer => (
            <div key={layer.layer} className={`card-static border ${layer.border}`}>
              <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${layer.color} px-2 py-0.5 rounded ${layer.bg} inline-block`}>
                {layer.layer}
              </div>
              <ul className="space-y-1.5">
                {layer.items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${layer.color}`}>
                      <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Transaction Flow */}
      <section className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <SectionTitle>Luồng Transaction</SectionTitle>
        <div className="card-static">
          <div className="flex flex-col sm:flex-row items-stretch gap-2 text-sm">
            {[
              { label: "Ví", sub: "getUtxos + getDRepKey", color: "bg-accent/15 border-accent/30 text-accent-light" },
              { label: "API", sub: "POST /tx/build → CBOR", color: "bg-accent-cyan/15 border-accent-cyan/30 text-accent-cyan" },
              { label: "Ví", sub: "wallet.signTx(cbor)", color: "bg-accent/15 border-accent/30 text-accent-light" },
              { label: "API", sub: "POST /tx/submit → txHash", color: "bg-success/15 border-success/30 text-success" },
              { label: "Chain", sub: "Xác nhận on-chain", color: "bg-accent-purple/15 border-accent-purple/30 text-accent-purple" },
            ].map((step, i, arr) => (
              <React.Fragment key={i}>
                <div className={`flex-1 flex flex-col items-center justify-center px-3 py-3 rounded-lg border text-center ${step.color}`}>
                  <div className="font-bold text-xs uppercase tracking-wide">{step.label}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <>
                    <svg className="hidden sm:flex self-center text-text-muted shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    <svg className="sm:hidden self-center text-text-muted shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-4">
            Private key không bao giờ rời ví — API chỉ nhận UTxO công khai và trả về unsigned CBOR.
          </p>
        </div>
      </section>

      {/* Links */}
      <section className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
        <SectionTitle>Tài nguyên hữu ích</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          {LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-start gap-3 group"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent-light shrink-0 mt-0.5 group-hover:text-accent transition-colors" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <div>
                <div className="font-semibold text-sm group-hover:text-accent-light transition-colors">{link.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{link.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <section className="text-center text-text-muted text-xs pb-4 space-y-1">
        <p>Tempo.Vote v2 — Xây dựng trên Cardano Mainnet &amp; Preprod</p>
        <p>
          Dữ liệu on-chain từ{" "}
          <ExternalLink href="https://ogmios.dev">Ogmios</ExternalLink> +{" "}
          <ExternalLink href="https://github.com/CardanoSolutions/kupo">Kupo</ExternalLink>.
        </p>
      </section>

    </div>
  )
}

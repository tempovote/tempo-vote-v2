"use client"

import { useState } from "react"

interface Section {
  id: string
  icon: React.ReactNode
  title: string
  shortTitle: string
  steps: { title: string; body: React.ReactNode }[]
}

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

const SECTIONS: Section[] = [
  {
    id: "wallet",
    icon: <WalletIcon />,
    title: "Kết nối ví Cardano",
    shortTitle: "Kết nối ví",
    steps: [
      {
        title: "Cài đặt ví tương thích",
        body: (
          <>
            <p>Tempo.Vote hỗ trợ mọi ví tuân thủ chuẩn CIP-30 và CIP-95:</p>
            <ul className="mt-2 space-y-1">
              {["Eternl", "Lace", "Yoroi", "Flint", "NuFi", "GeroWallet"].map(w => (
                <li key={w} className="flex items-center gap-2"><CheckIcon />{w}</li>
              ))}
            </ul>
            <Tip>Đảm bảo ví của bạn đang ở đúng mạng (Mainnet / Preprod) trước khi kết nối. Tempo.Vote tự động nhận diện mạng từ ví.</Tip>
          </>
        ),
      },
      {
        title: "Kết nối ví",
        body: (
          <>
            <p>Nhấn nút <strong className="text-text-primary">Connect Wallet</strong> ở góc trên phải Navbar. Chọn ví bạn đang dùng từ danh sách. Phê duyệt yêu cầu kết nối trong extension ví.</p>
            <Tip>Private key không bao giờ rời khỏi ví. Tempo.Vote chỉ đọc địa chỉ và UTxO công khai qua CIP-30.</Tip>
          </>
        ),
      },
      {
        title: "Kiểm tra trạng thái",
        body: (
          <p>Sau khi kết nối thành công, địa chỉ stake của bạn sẽ hiển thị ở Navbar. DRep key và voting power sẽ được tự động load từ ví.</p>
        ),
      },
    ],
  },
  {
    id: "drep",
    icon: <DRepIcon />,
    title: "DRep là gì & cách ủy quyền",
    shortTitle: "DRep",
    steps: [
      {
        title: "Hiểu về DRep (Delegated Representative)",
        body: (
          <>
            <p>DRep là đại diện bỏ phiếu trong hệ thống quản trị Cardano (Conway era). Ada holder ủy thác voting power cho DRep để DRep bỏ phiếu thay mặt trong các Governance Action.</p>
            <ul className="mt-2 space-y-1">
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Voting Power</strong>: tổng ADA ủy quyền cho DRep đó</span></li>
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Delegators</strong>: số ví đang ủy quyền cho DRep</span></li>
              <li className="flex gap-2"><CheckIcon /><span>Bạn có thể đổi DRep bất kỳ lúc nào, không mất phí đặc biệt</span></li>
            </ul>
          </>
        ),
      },
      {
        title: "Tìm DRep phù hợp",
        body: (
          <>
            <p>Truy cập trang <strong className="text-text-primary">DReps</strong> từ Navbar. Xem 4 bảng xếp hạng:</p>
            <ul className="mt-2 space-y-1">
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Delegators</strong>: DRep có nhiều người ủy quyền nhất</span></li>
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Voting Power</strong>: DRep nắm nhiều ADA nhất</span></li>
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Whale Delegators</strong>: DRep có nhiều cá voi (≥ 1M ADA) nhất</span></li>
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">VP Change</strong>: DRep có voting power thay đổi nhiều nhất gần đây</span></li>
            </ul>
          </>
        ),
      },
      {
        title: "Ủy quyền cho DRep",
        body: (
          <>
            <p>Nhấn nút <strong className="text-text-primary">Delegate</strong> trên profile DRep. Transaction sẽ được build tự động, bạn chỉ cần ký bằng ví. Sau khi confirm on-chain (~20 giây), voting power của bạn được chuyển sang DRep đó.</p>
            <Tip>Phí ủy quyền nhỏ (~0.17-0.2 ADA) do mạng Cardano thu, không phải Tempo.Vote.</Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "governance",
    icon: <GovIcon />,
    title: "Governance Actions",
    shortTitle: "Governance",
    steps: [
      {
        title: "Các loại Governance Action",
        body: (
          <>
            <p>Cardano Conway era có 7 loại Governance Action (GA):</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {[
                ["ParameterChange", "Thay đổi protocol parameters"],
                ["HardForkInitiation", "Nâng cấp protocol (hard fork)"],
                ["TreasuryWithdrawals", "Rút ADA từ Cardano Treasury"],
                ["NoConfidence", "Bất tín nhiệm Constitutional Committee"],
                ["UpdateCommittee", "Cập nhật thành viên CC"],
                ["NewConstitution", "Sửa đổi Hiến pháp Cardano"],
                ["InfoAction", "Thông báo on-chain (không binding)"],
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
        title: "Đọc thông tin GA",
        body: (
          <>
            <p>Truy cập trang <strong className="text-text-primary">Governance Actions</strong>. Mỗi GA card hiển thị:</p>
            <ul className="mt-2 space-y-1">
              <li className="flex gap-2"><CheckIcon /><span>Loại GA và trạng thái (Active / Ratified / Expired)</span></li>
              <li className="flex gap-2"><CheckIcon /><span>Tỉ lệ Yes/No/Abstain từ DRep + SPO + CC</span></li>
              <li className="flex gap-2"><CheckIcon /><span>Anchor URL dẫn đến tài liệu giải thích đầy đủ</span></li>
              <li className="flex gap-2"><CheckIcon /><span>Epoch hết hạn</span></li>
            </ul>
          </>
        ),
      },
      {
        title: "Bỏ phiếu (dành cho DRep đã đăng ký)",
        body: (
          <>
            <p>Nếu bạn là DRep đã đăng ký, nút <strong className="text-text-primary">Vote</strong> sẽ xuất hiện trên mỗi GA. Chọn Yes / No / Abstain, thêm rationale URL (tùy chọn), ký và submit.</p>
            <Tip>Rationale là URL dẫn đến tài liệu giải thích lý do bỏ phiếu của bạn — rất quan trọng để xây dựng uy tín DRep.</Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "polls",
    icon: <PollIcon />,
    title: "Community Polls",
    shortTitle: "Polls",
    steps: [
      {
        title: "Quick Poll là gì",
        body: (
          <p>Community Quick Poll là công cụ thăm dò ý kiến cộng đồng on-chain nhẹ — không cần ký transaction. Kết quả được tính theo voting power (ADA) của ví kết nối, phản ánh trọng số ý kiến thực tế của cộng đồng Cardano.</p>
        ),
      },
      {
        title: "Tham gia poll",
        body: (
          <>
            <p>Kết nối ví ở Navbar, sau đó chọn lựa chọn trong mỗi poll ở trang chủ. Voting power của bạn được ghi nhận tức thì, không tốn phí gas, không cần ký.</p>
            <Tip>Poll không có giá trị pháp lý on-chain — đây là công cụ thăm dò ý kiến, không phải Governance Action.</Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "treasury",
    icon: <ChartIcon />,
    title: "Treasury Projection Tool",
    shortTitle: "Treasury",
    steps: [
      {
        title: "Mục đích",
        body: (
          <p>Tool mô phỏng diễn biến Cardano Treasury và Reserves theo thời gian dựa trên monetary policy hiện tại (ρ = 0.3%/epoch, τ = 20%). Dùng để ước tính khả năng sustain của Treasury khi funding DApps, public goods, và các dự án Cardano.</p>
        ),
      },
      {
        title: "Cách dùng",
        body: (
          <>
            <p>Truy cập <strong className="text-text-primary">Others → Treasury Projection</strong>. Điều chỉnh 2 tham số:</p>
            <ul className="mt-2 space-y-1">
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Avg TX Fees / Epoch</strong>: phí giao dịch mạng đóng góp vào Treasury mỗi epoch</span></li>
              <li className="flex gap-2"><CheckIcon /><span><strong className="text-text-primary">Treasury Withdrawal / Year</strong>: lượng ADA rút từ Treasury mỗi năm (funding dự án)</span></li>
            </ul>
            <p className="mt-2">Biểu đồ hiển thị 15 năm dự báo. Dòng cam đánh dấu năm Treasury cạn (nếu có).</p>
            <Tip>Số liệu ban đầu lấy từ mainnet 2026: Reserves ~6.5B ₳, Treasury ~1.6B ₳. Chỉ mang tính minh họa, không phải dự báo chính thức.</Tip>
          </>
        ),
      },
    ],
  },
  {
    id: "ranking",
    icon: <VoteIcon />,
    title: "DApp Ranking",
    shortTitle: "DApp Ranking",
    steps: [
      {
        title: "Bảng xếp hạng DApp Cardano",
        body: (
          <p>Trang <strong className="text-text-primary">DApp Ranking</strong> tổng hợp dữ liệu protocol Cardano: Total Value Locked (TVL), khối lượng giao dịch, phí thu được. Dùng để theo dõi sức khỏe hệ sinh thái DeFi Cardano.</p>
        ),
      },
      {
        title: "Đọc Protocol Table",
        body: (
          <>
            <p>Mỗi hàng là một protocol DeFi, hiển thị:</p>
            <ul className="mt-2 space-y-1">
              <li className="flex gap-2"><CheckIcon /><span>TVL và thay đổi 24h / 7d</span></li>
              <li className="flex gap-2"><CheckIcon /><span>Volume giao dịch</span></li>
              <li className="flex gap-2"><CheckIcon /><span>Mức độ rủi ro (Minor / Medium / Major / Critical)</span></li>
            </ul>
          </>
        ),
      },
    ],
  },
]

export default function UserGuidesPage() {
  const [active, setActive] = useState(SECTIONS[0]!.id)
  const section = SECTIONS.find(s => s.id === active)!

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold gradient-text">User Guides</h1>
        <p className="text-text-secondary text-sm">
          Hướng dẫn sử dụng Tempo.Vote — nền tảng quản trị Cardano cho DRep và cộng đồng.
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
                      Trước
                    </button>
                  )}
                  {next && (
                    <button
                      onClick={() => setActive(next.id)}
                      className="ml-auto flex items-center gap-1.5 text-text-secondary hover:text-accent-light transition-colors"
                    >
                      Tiếp
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

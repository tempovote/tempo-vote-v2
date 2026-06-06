// =============================================================================
// Mock Data for tempo-vote-v2
// All data is placeholder — will be replaced with real API calls later
// =============================================================================

// ── DApp Ranking ────────────────────────────────────────────────────────────

export interface Protocol {
  rank: number
  name: string
  logo: string // emoji placeholder
  tvl: string
  vol: string
  riskLevel: "Medium" | "Unknown" | "Minor" | "Critical" | "Major"
  txCount: string
  activeWallet30d: string
  activeWallet7d: string
}

export const mockProtocols: Protocol[] = [
  { rank: 1,  name: "Minswap",                 logo: "🔄", tvl: "155M", vol: "323M", riskLevel: "Medium",  txCount: "375K", activeWallet30d: "6.9K",  activeWallet7d: "3K"   },
  { rank: 2,  name: "Wanchain",                logo: "🌐", tvl: "95M",  vol: "197K", riskLevel: "Unknown", txCount: "277",  activeWallet30d: "34",    activeWallet7d: "16"   },
  { rank: 3,  name: "Danogo",                  logo: "🐉", tvl: "85M",  vol: "33M",  riskLevel: "Minor",   txCount: "2.2K", activeWallet30d: "80",    activeWallet7d: "48"   },
  { rank: 4,  name: "Djed StableCoin",          logo: "🪙", tvl: "33M",  vol: "1.3M", riskLevel: "Medium",  txCount: "361",  activeWallet30d: "29",    activeWallet7d: "25"   },
  { rank: 5,  name: "Wingriders",              logo: "🦅", tvl: "29M",  vol: "58M",  riskLevel: "Medium",  txCount: "108K", activeWallet30d: "2.9K",  activeWallet7d: "1.3K" },
  { rank: 6,  name: "Liqwid",                  logo: "💧", tvl: "20M",  vol: "14B",  riskLevel: "Medium",  txCount: "19K",  activeWallet30d: "335",   activeWallet7d: "204"  },
  { rank: 7,  name: "Surf",                    logo: "🏄", tvl: "18M",  vol: "19M",  riskLevel: "Medium",  txCount: "4.7K", activeWallet30d: "656",   activeWallet7d: "311"  },
  { rank: 8,  name: "SPLASH",                  logo: "💦", tvl: "17M",  vol: "12M",  riskLevel: "Minor",   txCount: "92K",  activeWallet30d: "2.4K",  activeWallet7d: "998"  },
  { rank: 9,  name: "SundaeSwap",              logo: "🍨", tvl: "15M",  vol: "6.3M", riskLevel: "Medium",  txCount: "50K",  activeWallet30d: "1.7K",  activeWallet7d: "668"  },
  { rank: 10, name: "CSWAP DEX",               logo: "⚡", tvl: "3.2M", vol: "32M",  riskLevel: "Critical", txCount: "5K",  activeWallet30d: "2.4K",  activeWallet7d: "888"  },
  { rank: 11, name: "VyFi Dex",                logo: "🔷", tvl: "2.5M", vol: "3.3M", riskLevel: "Medium",  txCount: "26K",  activeWallet30d: "1.7K",  activeWallet7d: "768"  },
  { rank: 12, name: "Atrium.io",               logo: "🏛️", tvl: "2.4M", vol: "735K", riskLevel: "Unknown", txCount: "250",  activeWallet30d: "81",    activeWallet7d: "59"   },
  { rank: 13, name: "Strike Finance",          logo: "⚡", tvl: "1.3M", vol: "50M",  riskLevel: "Critical", txCount: "8.2K", activeWallet30d: "719",  activeWallet7d: "106"  },
  { rank: 14, name: "Optim Finance",           logo: "🎯", tvl: "1.3M", vol: "227",  riskLevel: "Medium",  txCount: "58",   activeWallet30d: "9",     activeWallet7d: "4"    },
  { rank: 15, name: "Spectrum",                logo: "🌈", tvl: "1.2M", vol: "3.2M", riskLevel: "Medium",  txCount: "40K",  activeWallet30d: "949",   activeWallet7d: "372"  },
]

// ── DReps ───────────────────────────────────────────────────────────────────

export interface DRep {
  id: string
  name: string
  avatarColor: string
  activeVotingPower: string
  votingPowerChange: string
  delegators: number
  influencePower: string
}

export const mockTopDRepsByDelegators: DRep[] = [
  { id: "drep-1", name: "Yoroi Wallet",           avatarColor: "#3b82f6", activeVotingPower: "686.79M ₳", votingPowerChange: "+0.68%",  delegators: 11543, influencePower: "9.76%" },
  { id: "drep-2", name: "Eternl DRep Committee",  avatarColor: "#8b5cf6", activeVotingPower: "341.74M ₳", votingPowerChange: "+0.63%",  delegators: 4532,  influencePower: "4.86%" },
  { id: "drep-3", name: "Evernstate",             avatarColor: "#06b6d4", activeVotingPower: "152.14M ₳", votingPowerChange: "+1.41%",  delegators: 1823,  influencePower: "2.03%" },
  { id: "drep-4", name: "CryptoDraw",             avatarColor: "#22c55e", activeVotingPower: "233.03M ₳", votingPowerChange: "+0.33%",  delegators: 1746,  influencePower: "3.31%" },
  { id: "drep-5", name: "CentreVolta (MANGA Pool)", avatarColor: "#f59e0b", activeVotingPower: "84.73M ₳",  votingPowerChange: "-0.21%", delegators: 1432,  influencePower: "1.42%" },
]

export const mockTopDRepsByVotingPower: DRep[] = [
  { id: "drep-1", name: "Yoroi Wallet",           avatarColor: "#3b82f6", activeVotingPower: "686.79M ₳", votingPowerChange: "+0.68%",  delegators: 11543, influencePower: "9.76%" },
  { id: "drep-6", name: "YUTA",                   avatarColor: "#ec4899", activeVotingPower: "475.87M ₳", votingPowerChange: "+0.17%",  delegators: 87,    influencePower: "6.76%" },
  { id: "drep-7", name: "BlockScientists",         avatarColor: "#6366f1", activeVotingPower: "290.05M ₳", votingPowerChange: "+0.82%",  delegators: 324,   influencePower: "5.32%" },
  { id: "drep-8", name: "DANDELION",              avatarColor: "#14b8a6", activeVotingPower: "286.57M ₳", votingPowerChange: "+0.57%",  delegators: 423,   influencePower: "4.06%" },
  { id: "drep-2", name: "Eternl DRep Committee",  avatarColor: "#8b5cf6", activeVotingPower: "341.74M ₳", votingPowerChange: "+0.63%",  delegators: 4532,  influencePower: "4.86%" },
]

export const mockTopDRepsByChange: DRep[] = [
  { id: "drep-9",  name: "WolfsCapital",          avatarColor: "#f97316", activeVotingPower: "12.76M ₳",  votingPowerChange: "+48.71%", delegators: 10,    influencePower: "0.17%" },
  { id: "drep-3",  name: "Evernstate",            avatarColor: "#06b6d4", activeVotingPower: "152.14M ₳", votingPowerChange: "+1.41%",  delegators: 1823,  influencePower: "2.03%" },
  { id: "drep-10", name: "Sébastien Guillemot S/C", avatarColor: "#ef4444", activeVotingPower: "175.05M ₳", votingPowerChange: "+1.44%", delegators: 1283,  influencePower: "1.85%" },
  { id: "drep-1",  name: "Yoroi Wallet",          avatarColor: "#3b82f6", activeVotingPower: "686.79M ₳", votingPowerChange: "+0.68%",  delegators: 11543, influencePower: "9.76%" },
  { id: "drep-11", name: "GADA_edgarxela_GLPF.E", avatarColor: "#a855f7", activeVotingPower: "46.32M ₳",  votingPowerChange: "+0.83%", delegators: 921,   influencePower: "0.75%" },
]

export interface RegionData {
  name: string
  votingPower: string
  votingPowerPercent: number
  ccMembers: number
  ccMembersPercent: number
  drepCount: number
  drepCountPercent: number
  color: string
}

export const mockRegions: RegionData[] = [
  { name: "Asia",          votingPower: "28 (34.96%)",       votingPowerPercent: 34.96, ccMembers: 8,  ccMembersPercent: 27.59, drepCount: 65, drepCountPercent: 73.51, color: "#ef4444" },
  { name: "Europe",        votingPower: "923.8M (15.82%)",   votingPowerPercent: 15.82, ccMembers: 3,  ccMembersPercent: 10.34, drepCount: 75, drepCountPercent: 16.43, color: "#3b82f6" },
  { name: "Africa",        votingPower: "12.36M (1.33%)",    votingPowerPercent: 1.33,  ccMembers: 0,  ccMembersPercent: 0,     drepCount: 8,  drepCountPercent: 0.96,  color: "#22c55e" },
  { name: "North America", votingPower: "1.42B (24.27%)",    votingPowerPercent: 24.27, ccMembers: 12, ccMembersPercent: 41.38, drepCount: 89, drepCountPercent: 19.30, color: "#f59e0b" },
  { name: "South America", votingPower: "29.53M (1.01%)",    votingPowerPercent: 1.01,  ccMembers: 2,  ccMembersPercent: 6.90,  drepCount: 9,  drepCountPercent: 1.07,  color: "#a855f7" },
  { name: "Oceania",       votingPower: "81.73M (1.07%)",    votingPowerPercent: 1.07,  ccMembers: 4,  ccMembersPercent: 13.79, drepCount: 18, drepCountPercent: 1.13,  color: "#06b6d4" },
  { name: "Unknown",       votingPower: "1.79B (30.27%)",    votingPowerPercent: 30.27, ccMembers: 0,  ccMembersPercent: 0,     drepCount: 480,drepCountPercent: 72.91, color: "#6b7280" },
]

// ── Community Polls ─────────────────────────────────────────────────────────

export interface Poll {
  id: string
  question: string
  options: {
    label: string
    votes: number
    ada: string
  }[]
}

export const mockPolls: Poll[] = [
  {
    id: "poll-1",
    question: "Should the Cardano Constitution allow CEXs to serve as Constitutional Committees?",
    options: [
      { label: "Yes", votes: 127, ada: "341.31M" },
      { label: "No",  votes: 842, ada: "1.4B" },
    ],
  },
  {
    id: "poll-2",
    question: "Should Amaru be included in the 2025 roadmap?",
    options: [
      { label: "Yes", votes: 598, ada: "927M" },
      { label: "No",  votes: 41,  ada: "23.73M" },
    ],
  },
  {
    id: "poll-3",
    question: "How many times a year should DReps vote on the treasury and budget?",
    options: [
      { label: "5 times/year or more",       votes: 398, ada: "491.61M" },
      { label: "Less than 5 times/year",     votes: 167, ada: "302.46M" },
    ],
  },
]

// ── TVL Chart Data ──────────────────────────────────────────────────────────

export const mockTvlChartData = [
  { month: "Jul",  tvl: 280 },
  { month: "Sep",  tvl: 320 },
  { month: "Nov",  tvl: 310 },
  { month: "Jan",  tvl: 350 },
  { month: "Mar",  tvl: 400 },
  { month: "May",  tvl: 479 },
]

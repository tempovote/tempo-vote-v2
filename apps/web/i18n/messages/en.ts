// English — source of truth. ja.ts / vi.ts must match this shape (type Messages).
// No `as const`: leaf values stay `string` so translations can differ while the
// object SHAPE is still enforced on ja/vi via `const ja: Messages`.
const en = {
  common: {
    viewAll: "View all →",
    noData: "No data",
    status: {
      active: "Active",
      ratified: "Ratified",
      enacted: "Enacted",
      expired: "Expired",
    },
  },
  nav: {
    home: "Home",
    dappRanking: "DApp Ranking",
    dreps: "DReps",
    governanceActions: "Governance Actions",
    others: "Others",
    treasuryProjection: "Treasury Projection",
    userGuides: "User Guides",
    about: "About",
  },
  language: {
    label: "Language",
    en: "English",
    ja: "日本語",
    vi: "Tiếng Việt",
  },
  wallet: {
    connect: "Connect Wallet",
    connecting: "Connecting...",
    disconnect: "Disconnect wallet",
    networkLocked: "Network is locked to the connected wallet",
    lockedShort: "Locked to wallet",
  },
  banner: {
    pre: "View ",
    profile: "DRep profile",
    mid: " on Tempo and ",
    delegate: "delegate",
    post: " to help shape transparent Cardano governance!",
    close: "Close banner",
  },
  footer: {
    joinCommunity: "Join the community",
    rights: "© {year} Tempo. All rights reserved. Built for Cardano governance.",
  },
  home: {
    becomeDrep: {
      title: "Become a DRep",
      desc: "Contribute to Cardano by voting actively. ADA holders can delegate their voting power to you.",
      cta: "Register as DRep",
    },
    delegate: {
      title: "Delegate to a DRep",
      desc: "Find the right DRep, review their profile and voting history, then delegate your voting power to them.",
      cta: "Explore DReps",
    },
    gaHeading: "Governance Actions",
    topDreps: "Top DReps",
    noActiveGa: "No active governance actions",
    delegators: "delegators",
    votingPower: "Voting Power",
    stats: {
      currentEpoch: "Current Epoch",
      activeDreps: "Active DReps",
      totalDelegatedAda: "Total Delegated ADA",
      activeGa: "Active GAs",
    },
    drepBanner: {
      activeVotingPower: "Active Voting Power",
      liveVotingPower: "Live Voting Power",
      delegators: "Delegators",
      influencePower: "Influence Power",
      voted: "Voted",
      notVoted: "Not Voted",
      copyId: "Copy DRep ID",
      community: "Your DRep Community",
      selfDelegate: {
        title: "Voting Power not activated",
        desc: "You haven't self-delegated your stake to this DRep yet. Voting power will be {amount} until you complete this step.",
        cta: "Self-Delegate now",
        processing: "Processing…",
        txFailed: "Transaction failed",
      },
      pending: {
        title: "Delegation confirmed",
        desc: "Voting power will be updated at the start of the next epoch.",
      },
    },
  },
}

export type Messages = typeof en
export default en

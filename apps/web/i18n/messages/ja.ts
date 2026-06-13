import type { Messages } from "./en"

// 日本語 — machine-assisted translation. SHOULD be reviewed by a native speaker
// before production. Shape is enforced against en.ts via the Messages type.
const ja: Messages = {
  common: {
    viewAll: "すべて見る →",
    noData: "データなし",
    status: {
      active: "有効",
      ratified: "承認済み",
      enacted: "施行済み",
      expired: "期限切れ",
    },
  },
  nav: {
    home: "ホーム",
    dappRanking: "DAppランキング",
    dreps: "DRep一覧",
    governanceActions: "ガバナンスアクション",
    others: "その他",
    treasuryProjection: "トレジャリー予測",
    userGuides: "ユーザーガイド",
    about: "概要",
  },
  language: {
    label: "言語",
    en: "English",
    ja: "日本語",
    vi: "Tiếng Việt",
  },
  wallet: {
    connect: "ウォレット接続",
    connecting: "接続中...",
    disconnect: "ウォレットを切断",
    networkLocked: "ネットワークは接続中のウォレットに固定されています",
    lockedShort: "ウォレットに固定",
  },
  banner: {
    pre: "Tempoで",
    profile: "DRepプロフィール",
    mid: "を確認し、",
    delegate: "デリゲート",
    post: "して透明なCardanoガバナンスの形成に貢献しましょう！",
    close: "バナーを閉じる",
  },
  footer: {
    joinCommunity: "コミュニティに参加",
    rights: "© {year} Tempo. All rights reserved. Cardanoガバナンスのために構築。",
  },
  home: {
    becomeDrep: {
      title: "DRepになる",
      desc: "積極的に投票してCardanoに貢献しましょう。ADA保有者はあなたに投票権をデリゲートできます。",
      cta: "DRep登録",
    },
    delegate: {
      title: "DRepにデリゲート",
      desc: "適切なDRepを見つけ、プロフィールと投票履歴を確認し、投票権をデリゲートしましょう。",
      cta: "DRepを探す",
    },
    gaHeading: "ガバナンスアクション",
    topDreps: "トップDRep",
    noActiveGa: "有効なガバナンスアクションはありません",
    delegators: "デリゲーター",
    votingPower: "投票権",
    stats: {
      currentEpoch: "現在のエポック",
      activeDreps: "有効なDRep",
      totalDelegatedAda: "デリゲート済みADA総量",
      activeGa: "有効なGA",
    },
    drepBanner: {
      activeVotingPower: "有効投票権",
      liveVotingPower: "ライブ投票権",
      delegators: "デリゲーター",
      influencePower: "影響力",
      voted: "投票済み",
      notVoted: "未投票",
      copyId: "DRep IDをコピー",
      community: "あなたのDRepコミュニティ",
      selfDelegate: {
        title: "投票権が未有効化です",
        desc: "まだこのDRepにステークをセルフデリゲートしていません。このステップを完了するまで投票権は{amount}になります。",
        cta: "今すぐセルフデリゲート",
        processing: "処理中…",
        txFailed: "トランザクション失敗",
      },
      pending: {
        title: "デリゲートが確認されました",
        desc: "投票権は次のエポックの開始時に更新されます。",
      },
    },
  },
}

export default ja

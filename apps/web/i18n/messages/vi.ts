import type { Messages } from "./en"

// Tiếng Việt. Shape được enforce theo en.ts qua type Messages.
const vi: Messages = {
  common: {
    viewAll: "Xem tất cả →",
    noData: "Không có dữ liệu",
    status: {
      active: "Đang hoạt động",
      ratified: "Đã phê chuẩn",
      enacted: "Đã thi hành",
      expired: "Hết hạn",
    },
  },
  nav: {
    home: "Trang chủ",
    dappRanking: "Xếp hạng DApp",
    dreps: "DReps",
    governanceActions: "Hành động Quản trị",
    others: "Khác",
    treasuryProjection: "Dự phóng Ngân khố",
    userGuides: "Hướng dẫn",
    about: "Giới thiệu",
  },
  language: {
    label: "Ngôn ngữ",
    en: "English",
    ja: "日本語",
    vi: "Tiếng Việt",
  },
  wallet: {
    connect: "Kết nối ví",
    connecting: "Đang kết nối...",
    disconnect: "Ngắt kết nối ví",
    networkLocked: "Mạng được khóa theo ví đang kết nối",
    lockedShort: "Khóa theo ví",
  },
  banner: {
    pre: "Xem ",
    profile: "hồ sơ DRep",
    mid: " trên Tempo và ",
    delegate: "delegate",
    post: " để góp phần định hình quản trị Cardano minh bạch!",
    close: "Đóng banner",
  },
  footer: {
    joinCommunity: "Tham gia cộng đồng",
    rights: "© {year} Tempo. Bảo lưu mọi quyền. Xây dựng cho quản trị Cardano.",
  },
  home: {
    becomeDrep: {
      title: "Trở thành DRep",
      desc: "Đóng góp cho Cardano bằng cách bỏ phiếu tích cực. Người nắm giữ ADA có thể delegate voting power cho bạn.",
      cta: "Đăng ký DRep",
    },
    delegate: {
      title: "Delegate cho DRep",
      desc: "Tìm DRep phù hợp, xem profile và lịch sử bỏ phiếu, sau đó delegate voting power của bạn cho họ.",
      cta: "Khám phá DReps",
    },
    gaHeading: "Hành động Quản trị",
    topDreps: "Top DReps",
    noActiveGa: "Không có GA đang active",
    delegators: "delegators",
    votingPower: "Voting Power",
    stats: {
      currentEpoch: "Epoch hiện tại",
      activeDreps: "DReps đang active",
      totalDelegatedAda: "Tổng ADA được delegate",
      activeGa: "GA đang active",
    },
    drepBanner: {
      activeVotingPower: "Active Voting Power",
      liveVotingPower: "Live Voting Power",
      delegators: "Delegators",
      influencePower: "Influence Power",
      voted: "Đã bỏ phiếu",
      notVoted: "Chưa bỏ phiếu",
      copyId: "Copy DRep ID",
      community: "Cộng đồng DRep của bạn",
      selfDelegate: {
        title: "Voting Power chưa được kích hoạt",
        desc: "Bạn chưa self-delegate stake về DRep này. Voting power sẽ bằng {amount} cho đến khi hoàn tất bước này.",
        cta: "Self-Delegate ngay",
        processing: "Đang xử lý…",
        txFailed: "TX thất bại",
      },
      pending: {
        title: "Delegation đã xác nhận",
        desc: "Voting power sẽ được cập nhật vào đầu epoch tiếp theo.",
      },
    },
  },
}

export default vi

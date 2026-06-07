interface Props {
  txHash: string
  drepName: string
  networkId: number | null
  successMessage?: string
  delegateTxHash?: string | null
}

function TxHashBlock({
  label,
  txHash,
  explorerBase,
}: {
  label: string
  txHash: string
  explorerBase: string
}) {
  const short = `${txHash.slice(0, 12)}...${txHash.slice(-8)}`
  const url = `${explorerBase}/${txHash}`
  return (
    <div className="card-static text-left space-y-1">
      <p className="text-text-muted text-xs font-medium">{label}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm text-accent hover:text-accent-light break-all transition-colors"
      >
        {short}
      </a>
    </div>
  )
}

export default function RegisterDRepSuccess({
  txHash,
  drepName,
  networkId,
  successMessage = "Đăng ký thành công!",
  delegateTxHash,
}: Props) {
  const explorerBase =
    networkId === 1
      ? "https://cardanoscan.io/transaction"
      : "https://preprod.cardanoscan.io/transaction"

  const registrationExplorerUrl = `${explorerBase}/${txHash}`

  return (
    <div className="text-center space-y-6 py-4">
      {/* Icon */}
      <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-text-primary">{successMessage}</h2>
        <p className="text-text-secondary text-sm mt-1">
          <span className="text-accent font-semibold">{drepName}</span> đã được gửi lên Cardano blockchain.
        </p>
      </div>

      {/* TX hashes */}
      <div className="space-y-2">
        <TxHashBlock
          label={delegateTxHash ? "TX 1 — Đăng ký DRep" : "Transaction Hash"}
          txHash={txHash}
          explorerBase={explorerBase}
        />
        {delegateTxHash && (
          <TxHashBlock
            label="TX 2 — Ủy quyền voting power"
            txHash={delegateTxHash}
            explorerBase={explorerBase}
          />
        )}
      </div>

      {/* Notice */}
      <div className="notice text-sm text-left">
        <p className="font-medium text-text-primary mb-1">Chờ xác nhận on-chain</p>
        <p className="text-text-secondary text-xs">
          Transaction cần khoảng 20–60 giây để được confirm. Sau khi confirm, DRep ID của bạn sẽ
          xuất hiện trong danh sách DRep trên chain và ví sẽ hiển thị trạng thái đã đăng ký.
        </p>
        {delegateTxHash && (
          <p className="text-text-secondary text-xs mt-1.5">
            Voting power sẽ được cập nhật tại <span className="text-text-primary font-medium">epoch boundary tiếp theo</span> (~1–5 ngày).
            Nếu chưa thấy voting power, bạn có thể self-delegate lại từ trang profile DRep.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={registrationExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline flex-1 text-center"
        >
          Xem trên CardanoScan ↗
        </a>
        <a href="/dreps" className="btn-primary flex-1 text-center">
          Danh sách DRep
        </a>
      </div>
    </div>
  )
}

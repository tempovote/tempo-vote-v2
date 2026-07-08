import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { WalletConnectModal, type WalletOption } from "./wallet-connect-modal"
import { Button } from "./button"

const WALLETS: WalletOption[] = [
  { id: "eternl", label: "Eternl", icon: null, installed: true, supportsCip95: true },
  { id: "lace", label: "Lace", icon: null, installed: true, supportsCip95: true },
  { id: "yoroi", label: "Yoroi", icon: null, installed: false, installUrl: "https://yoroi-wallet.com" },
  { id: "nufi", label: "NuFi", icon: null, installed: false, installUrl: "https://nu.fi" },
]

const LABELS = {
  title: "Connect Wallet",
  connectingTitle: "Connecting…",
  connectingTo: (name: string) => `Connecting to ${name}…`,
  approvalHint: "Approve the connection in your wallet extension.",
  selectPrompt: "Select a wallet to connect:",
  notInstalled: "Not installed",
  install: "Install",
}

function Demo({ connectingId, error, errorAction }: { connectingId?: string; error?: string; errorAction?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <WalletConnectModal
        open={open}
        onOpenChange={setOpen}
        wallets={WALLETS}
        connectingId={connectingId}
        error={error}
        errorAction={
          errorAction ? (
            <div className="flex items-center justify-between pl-5">
              <span className="text-muted-foreground-subtle">Session expired.</span>
              <button type="button" className="ml-2 shrink-0 font-medium text-primary-light hover:underline">
                Reload
              </button>
            </div>
          ) : undefined
        }
        onSelect={(id) => console.log("select", id)}
        labels={LABELS}
      />
    </>
  )
}

const meta: Meta<typeof WalletConnectModal> = {
  title: "Domain/WalletConnectModal",
  component: WalletConnectModal,
}
export default meta
type Story = StoryObj<typeof WalletConnectModal>

export const SelectWallet: Story = { render: () => <Demo /> }
export const Connecting: Story = { render: () => <Demo connectingId="eternl" /> }
export const WithError: Story = { render: () => <Demo error="Wallet is locked. Unlock and retry." errorAction /> }

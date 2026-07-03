import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState } from "react";

export default function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  // ── Not connected ─────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div style={{ position: "relative", zIndex: 99 }}>
        <button
          className="connect-btn"
          onClick={() => {
            const injected = connectors[0];
            if (injected) connect({ connector: injected });
          }}
          disabled={isPending}
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────
  const shortAddress =
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const wrongNetwork = chain?.id !== 11155111; // Sepolia

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {wrongNetwork && (
        <span className="wrong-network-badge">Wrong Network</span>
      )}
      <div style={{ position: "relative", zIndex: 99 }}>
        <button
          className="wallet-connected-btn"
          onClick={() => setShowMenu((v) => !v)}
        >
          <span className="wallet-dot" />
          {shortAddress}
        </button>

        {showMenu && (
          <>
            <div className="wallet-menu">
              <div className="wallet-address-full">{address}</div>
              <button
                className="wallet-option wallet-option-danger"
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
              >
                <span className="wallet-option-icon">🔌</span>
                Disconnect
              </button>
            </div>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 98 }}
              onClick={() => setShowMenu(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}

import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected(), // MetaMask, Rabby, Brave Wallet, any injected wallet
  ],
  transports: {
    [sepolia.id]: http(),
  },
});
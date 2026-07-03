import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY   = process.env.PRIVATE_KEY    || "0x" + "0".repeat(64);
const SEPOLIA_RPC   = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      url: SEPOLIA_RPC,
      chainId: 11155111,
      accounts: [PRIVATE_KEY],
    },
  },
});
import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect("sepolia");
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log("Deploying NullClaim with:", walletClient.account.address);

  const balance = await publicClient.getBalance({
    address: walletClient.account.address,
  });
  console.log("Balance:", balance, "wei\n");

  // $50,000 threshold (USD x100 = 5,000,000)
  const INITIAL_MAX_AMOUNT = 5_000_000n;

  const nullClaim = await viem.deployContract("NullClaim", [INITIAL_MAX_AMOUNT]);

  console.log("\n✅ NullClaim deployed to:", nullClaim.address);
  console.log("   Network:   Sepolia");
  console.log("   Threshold: $50,000\n");
  console.log("Next steps:");
  console.log(`  1. Add to frontend/.env.local:  VITE_CONTRACT_ADDRESS=${nullClaim.address}`);
  console.log(`  2. Add to backend/.env:         CONTRACT_ADDRESS=${nullClaim.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
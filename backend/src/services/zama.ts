import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";

/**
 * ZamaService
 *
 * Wraps the Zama SDK for server-side operations:
 * - Fetching encrypted verdicts from the NullClaim contract
 * - Reading on-chain claim metadata
 * - Polling for Gateway decryption callbacks
 *
 * NOTE: Client-side FHE encryption (encrypting claim fields) happens in the
 * browser via @zama-fhe/sdk + WASM Web Worker, not here. This service
 * handles read operations and verdict polling only.
 */

const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || "0x0") as Address;

// Minimal ABI — only what the backend needs to read
const NULL_CLAIM_ABI = [
  {
    name: "getVerdict",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [
      { name: "decrypted",   type: "bool" },
      { name: "isFraud",     type: "bool" },
      { name: "submitter",   type: "address" },
      { name: "submittedAt", type: "uint256" },
    ],
  },
  {
    name: "totalClaims",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getClaimsBySubmitter",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "submitter", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "VerdictReady",
    type: "event",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "isFraud", type: "bool",    indexed: false },
    ],
  },
] as const;

// Public viem client — read-only, no private key needed
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"),
});

// ── Read verdict for a claim ID ───────────────────────────────────────────────
export async function getClaimVerdict(claimId: bigint) {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: NULL_CLAIM_ABI,
    functionName: "getVerdict",
    args: [claimId],
  });

  const [decrypted, isFraud, submitter, submittedAt] = result;
  return { decrypted, isFraud, submitter, submittedAt: Number(submittedAt) };
}

// ── Get total claim count ─────────────────────────────────────────────────────
export async function getTotalClaims(): Promise<number> {
  const total = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: NULL_CLAIM_ABI,
    functionName: "totalClaims",
    args: [],
  });
  return Number(total);
}

// ── Get claim IDs for a submitter address ─────────────────────────────────────
export async function getClaimsBySubmitter(submitter: Address): Promise<number[]> {
  const ids = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: NULL_CLAIM_ABI,
    functionName: "getClaimsBySubmitter",
    args: [submitter],
  });
  return ids.map(Number);
}

// ── Poll until verdict is ready (Gateway decryption can take ~10–30s) ─────────
export async function pollForVerdict(
  claimId: bigint,
  maxAttempts = 20,
  intervalMs = 3000
): Promise<{ isFraud: boolean } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { decrypted, isFraud } = await getClaimVerdict(claimId);
    if (decrypted) return { isFraud };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null; // timeout
}
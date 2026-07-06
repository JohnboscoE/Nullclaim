export const CONTRACT_ADDRESS = (
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x8702e8fa11d5619dbed1db48f17ce7c873ac6a51"
) as `0x${string}`;

export const NULL_CLAIM_ABI = [
  // ── Write ──────────────────────────────────────────────────────────
  {
    name: "submitClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_encAmount",      type: "bytes32" }, // externalEuint64 = bytes32 on ABI level
      { name: "_encProviderId",  type: "bytes32" },
      { name: "_encPatientHash", type: "bytes32" },
      { name: "_encServiceCode", type: "bytes32" },
      { name: "_encTimestamp",   type: "bytes32" },
      { name: "inputProof",      type: "bytes"   },
    ],
    outputs: [{ name: "claimId", type: "uint256" }],
  },
  {
    name: "updateMaxAmount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_encNewMax",  type: "bytes32" },
      { name: "inputProof",  type: "bytes"   },
    ],
    outputs: [],
  },
  {
    name: "blacklistProvider",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_encProviderId", type: "bytes32" },
      { name: "inputProof",     type: "bytes"   },
    ],
    outputs: [],
  },

  // ── Read ───────────────────────────────────────────────────────────
  {
    name: "getVerdict",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [
      { name: "decrypted",   type: "bool"    },
      { name: "isFraud",     type: "bool"    },
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
    name: "claimCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ── Events ─────────────────────────────────────────────────────────
  {
    name: "ClaimSubmitted",
    type: "event",
    inputs: [
      { name: "claimId",   type: "uint256", indexed: true  },
      { name: "submitter", type: "address", indexed: true  },
    ],
  },
  {
    name: "VerdictReady",
    type: "event",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true  },
      { name: "isFraud", type: "bool",    indexed: false },
    ],
  },
] as const;

/**
 * Hash a string value to a uint64 for use as an encrypted field.
 * Takes the first 8 bytes of the string's char codes.
 */
export function hashToUint64(value: string): bigint {
  let hash = 0n;
  for (let i = 0; i < Math.min(value.length, 8); i++) {
    hash = (hash << 8n) | BigInt(value.charCodeAt(i));
  }
  return hash & 0xFFFFFFFFFFFFFFFFn;
}
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { CONTRACT_ADDRESS } from "./contract";

let instance: FhevmInstance | null = null;

// Backend proxy avoids browser CORS block on the Zama relayer
// The proxy forwards requests to https://relayer.testnet.zama.cloud
const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const RELAYER_PROXY_URL = `${BACKEND_URL}/api/relayer/11155111`;

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (instance) return instance;

  console.log("Initializing FHE via backend proxy:", RELAYER_PROXY_URL);

  instance = await createInstance({
    ...SepoliaConfig,
    relayerUrl: RELAYER_PROXY_URL,
  });

  console.log("FHE instance ready");
  return instance;
}

export async function encryptClaimInputs(
  signerAddress: string,
  claimAmount: bigint,
  providerId:  bigint,
  patientHash: bigint,
  serviceCode: bigint,
  timestamp:   bigint
) {
  const fhevm = await getFhevmInstance();

  const input = fhevm.createEncryptedInput(CONTRACT_ADDRESS, signerAddress);

  input.add64(claimAmount);
  input.add64(providerId);
  input.add64(patientHash);
  input.add64(serviceCode);
  input.add64(timestamp);

  const encrypted = await input.encrypt();

  return {
    encAmount:      bytesToHex(encrypted.handles[0]),
    encProviderId:  bytesToHex(encrypted.handles[1]),
    encPatientHash: bytesToHex(encrypted.handles[2]),
    encServiceCode: bytesToHex(encrypted.handles[3]),
    encTimestamp:   bytesToHex(encrypted.handles[4]),
    inputProof:     bytesToHex(encrypted.inputProof),
  };
}
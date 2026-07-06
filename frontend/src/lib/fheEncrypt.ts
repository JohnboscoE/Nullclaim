import { createInstance, initSDK, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { getAddress } from "viem";
import { CONTRACT_ADDRESS } from "./contract";

let instance: FhevmInstance | null = null;

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (instance) return instance;

  // Initialize the WASM SDK first
  await initSDK();

  // Use window.ethereum as the network provider — this is the correct pattern
  // SepoliaConfig includes the correct relayerUrl and all contract addresses
  instance = await createInstance({
    ...SepoliaConfig,
    network: (window as Window & { ethereum?: unknown }).ethereum,
  });

  console.log("FHE instance initialized");
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
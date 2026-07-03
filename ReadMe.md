# NullClaim

> FHE-powered insurance claim fraud detection that never sees the claim.

Built with [Zama FHEVM](https://docs.zama.ai) for the **Zama Developer Program — Builder Track**.
Deployed on Ethereum Sepolia testnet.

---

## Project Structure

```
nullclaim/
│
├── frontend/               # Next.js 14 + TypeScript — UI only
│   ├── src/pages/
│   │   ├── index.tsx       # Landing page with animated claim pipeline demo
│   │   └── dashboard.tsx   # Claim submission, progress, verdict display
│   ├── .env.example
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                # Express + TypeScript — API + Zama SDK reads
│   ├── src/
│   │   ├── index.ts        # Express server entry point
│   │   ├── routes/
│   │   │   ├── claims.ts   # GET /api/claims/total, /submitter/:address
│   │   │   └── verdicts.ts # GET /api/verdicts/:claimId, /:claimId/poll
│   │   └── services/
│   │       └── zama.ts     # viem read client + verdict polling
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
└── contracts/              # Hardhat + Solidity + Zama FHEVM
    ├── contracts/
    │   └── NullClaim.sol   # Core FHE smart contract
    ├── scripts/
    │   └── deploy.ts       # Sepolia deployment script
    ├── .env.example
    ├── hardhat.config.ts
    └── package.json
```

---

## How It Works

1. **Claim submitted** — User fills in claim fields (amount, provider ID, patient hash). The Zama SDK encrypts them client-side into `euint64` ciphertexts before broadcasting.

2. **FHE contract evaluates** — `NullClaim.sol` runs three fraud rules entirely over encrypted data using `FHE.gt()`, `FHE.eq()`, `FHE.or()`. No plaintext ever exists on-chain.

3. **Verdict decrypted** — The Zama Gateway performs threshold decryption on only the final `ebool`. `VerdictReady(claimId, isFraud)` is emitted. Claim details remain sealed.

---

## Quick Start

### 1 — Contracts

```bash
cd contracts
npm install
cp .env.example .env          # fill in PRIVATE_KEY + SEPOLIA_RPC_URL
npm run compile
npm run deploy:sepolia
# Copy the deployed address to frontend/.env.local and backend/.env
```

### 2 — Backend

```bash
cd backend
npm install
cp .env.example .env          # fill in CONTRACT_ADDRESS + SEPOLIA_RPC_URL
npm run dev                   # http://localhost:4000
```

### 3 — Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # fill in NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev                   # http://localhost:3000
```

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Contracts | Solidity 0.8.24 · Zama FHEVM (`fhevm`) · Hardhat |
| FHE Types | `euint64` · `ebool` · `GatewayCaller` |
| Backend   | Express 4 · TypeScript · viem · Zama SDK |
| Frontend  | Next.js 14 · TypeScript · React · wagmi v2 |
| Network   | Ethereum Sepolia Testnet |

---

## Fraud Rules (on-chain, FHE)

| Rule | FHE Operation |
|------|--------------|
| Amount exceeds threshold | `FHE.gt(encAmount, encMaxAmount)` |
| Provider is blacklisted | `FHE.eq(encProviderId, encBlacklist[i])` |
| Velocity / rate limit | plain count check → `TFHE.asEbool(bool)` |
| Aggregate | `FHE.or(rule1, FHE.or(rule2, rule3))` |

---

## License

MIT — Built for the Zama Developer Program.
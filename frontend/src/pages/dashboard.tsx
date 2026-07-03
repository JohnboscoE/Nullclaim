import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import WalletButton from "@/components/ui/WalletButton";
import { CONTRACT_ADDRESS, NULL_CLAIM_ABI, hashToUint64 } from "@/lib/contract";
import { encryptClaimInputs } from "@/lib/fheEncrypt";

// ── Types ──────────────────────────────────────────────────────────────
type ClaimStatus =
  | "idle"
  | "encrypting"
  | "submitting"
  | "waiting"
  | "polling"
  | "done"
  | "error";
type VerdictType = "CLEAN" | "FLAGGED" | null;

interface ClaimForm {
  claimAmount: string;
  providerId: string;
  patientHash: string;
  serviceCode: string;
  claimDate: string;
}

interface HistoryEntry {
  id: string;
  time: string;
  amount: string;
  provider: string;
  verdict: VerdictType;
  txHash: string;
}

// ── Constants ──────────────────────────────────────────────────────────
const FRAUD_RULES = [
  { label: "Amount threshold breach", detail: "FHE.gt(amount, maxAllowed)" },
  {
    label: "Duplicate claim detection",
    detail: "FHE.eq(claimHash, history[])",
  },
  { label: "Blacklisted provider", detail: "FHE.eq(providerId, blacklist[])" },
  { label: "Velocity check (24h)", detail: "FHE.gt(dailyCount, rateLimit)" },
];

const STATUS_STEPS = [
  { key: "encrypting", label: "Preparing encrypted inputs" },
  { key: "submitting", label: "Sending transaction to Sepolia" },
  { key: "waiting", label: "Waiting for confirmation" },
  { key: "polling", label: "FHE contract evaluating claim" },
  { key: "done", label: "Verdict decrypted by Gateway" },
];

const STEP_ORDER = ["encrypting", "submitting", "waiting", "polling", "done"];

const CHARS = "ABCDEFabcdef0123456789!@#$%";
function scramble(len: number) {
  return Array.from(
    { length: len },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join("");
}
function getStepState(
  current: ClaimStatus,
  key: string,
): "pending" | "active" | "done" {
  const ci = STEP_ORDER.indexOf(current);
  const si = STEP_ORDER.indexOf(key);
  if (ci === -1 || si === -1) return "pending";
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "pending";
}

function friendlyError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("user rejected"))
    return "Transaction rejected in wallet.";
  if (msg.includes("reverted"))
    return "Transaction reverted on-chain. The FHE proof was rejected — try redeploying the contract.";
  // Show raw error for all other cases so we can diagnose
  return msg.slice(0, 300);
}

// ── Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [form, setForm] = useState<ClaimForm>({
    claimAmount: "",
    providerId: "",
    patientHash: "",
    serviceCode: "",
    claimDate: "",
  });
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [verdict, setVerdict] = useState<VerdictType>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | "">("");
  const [claimId, setClaimId] = useState<bigint | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scrambleTxt, setScrambleTxt] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Scramble animation while encrypting
  useEffect(() => {
    if (status !== "encrypting") return;
    const id = setInterval(() => setScrambleTxt(scramble(56)), 55);
    return () => clearInterval(id);
  }, [status]);

  // ── Wagmi hooks ────────────────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();

  const {
    isSuccess: isTxSuccess,
    isError: isTxError,
    data: receipt,
    failureReason,
  } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
    timeout: 60_000,
  });

  // ── Handle tx failure ──────────────────────────────────────────────
  useEffect(() => {
    if (!isTxError && !failureReason) return;
    const msg = failureReason?.message || "Transaction failed or reverted";
    setErrorMsg(friendlyError(msg));
    setStatus("error");
  }, [isTxError, failureReason]);

  // ── Detect reverted receipts ───────────────────────────────────────
  useEffect(() => {
    if (!receipt) return;
    if (receipt.status === "reverted") {
      setErrorMsg(
        "Transaction reverted on-chain. The FHE proof was rejected — this usually means the Zama relayer returned an invalid proof. Try again when the relayer is stable.",
      );
      setStatus("error");
    }
  }, [receipt]);

  // ── Extract claimId from logs after confirmation ───────────────────
  useEffect(() => {
    if (!isTxSuccess || !receipt || !publicClient) return;
    if (receipt.status === "reverted") return;

    const extractClaimId = async () => {
      try {
        for (const log of receipt.logs) {
          if (
            log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() &&
            log.topics.length >= 2
          ) {
            setClaimId(BigInt(log.topics[1] as string));
            setStatus("polling");
            return;
          }
        }
        const total = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: NULL_CLAIM_ABI,
          functionName: "totalClaims",
        });
        setClaimId(total as bigint);
        setStatus("polling");
      } catch (e) {
        console.error("Failed to extract claimId:", e);
        setStatus("polling");
      }
    };

    extractClaimId();
  }, [isTxSuccess, receipt, publicClient]);

  // Move to waiting + 90s safety timeout
  useEffect(() => {
    if (!(txHash && status === "submitting")) return;
    setStatus("waiting");
    const timeout = setTimeout(() => {
      setStatus((cur) => {
        if (cur !== "waiting") return cur;
        setErrorMsg(
          "Transaction confirmation timed out. Check Etherscan for status.",
        );
        return "error";
      });
    }, 90_000);
    return () => clearTimeout(timeout);
  }, [txHash, status]);

  // ── Poll for verdict ───────────────────────────────────────────────
  useEffect(() => {
    if (status !== "polling" || claimId === null || !publicClient) return;
    let cancelled = false;
    let attempts = 0;
    const MAX = 40;

    const poll = async () => {
      while (!cancelled && attempts < MAX) {
        try {
          const result = (await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: NULL_CLAIM_ABI,
            functionName: "getVerdict",
            args: [claimId],
          })) as [boolean, boolean, string, bigint];

          const [decrypted, isFraud] = result;
          if (decrypted) {
            setVerdict(isFraud ? "FLAGGED" : "CLEAN");
            setStatus("done");
            setHistory((prev) => [
              {
                id: `CLM-${String(Number(claimId)).padStart(3, "0")}`,
                time: "just now",
                amount: `$${Number(form.claimAmount).toLocaleString()}`,
                provider: form.providerId || "—",
                verdict: isFraud ? "FLAGGED" : "CLEAN",
                txHash:
                  txHash ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}` : "—",
              },
              ...prev.slice(0, 4),
            ]);
            return;
          }
        } catch (e) {
          console.error("Poll error:", e);
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled && attempts >= MAX) {
        setErrorMsg(
          "Verdict polling timed out. The Zama Gateway may still be processing — check back later.",
        );
        setStatus("error");
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [status, claimId, publicClient]);

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (
      !isConnected ||
      !form.claimAmount ||
      !form.providerId ||
      !form.patientHash
    )
      return;

    try {
      setStatus("encrypting");
      setVerdict(null);
      setTxHash("");
      setClaimId(null);
      setErrorMsg("");

      await new Promise((r) => setTimeout(r, 500));

      const amountCents = BigInt(
        Math.round(parseFloat(form.claimAmount) * 100),
      );
      const providerNum = hashToUint64(form.providerId);
      const patientNum = hashToUint64(form.patientHash);
      const serviceNum = hashToUint64(form.serviceCode || "0");
      const timestampNum =
        form.claimDate ?
          BigInt(Math.floor(new Date(form.claimDate).getTime() / 1000))
        : BigInt(Math.floor(Date.now() / 1000));

      const {
        encAmount,
        encProviderId,
        encPatientHash,
        encServiceCode,
        encTimestamp,
        inputProof,
      } = await encryptClaimInputs(
        address!,
        amountCents,
        providerNum,
        patientNum,
        serviceNum,
        timestampNum,
      );

      setStatus("submitting");

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: NULL_CLAIM_ABI,
        functionName: "submitClaim",
        args: [
          encAmount,
          encProviderId,
          encPatientHash,
          encServiceCode,
          encTimestamp,
          inputProof,
        ],
        gas: 500_000n,
      });

      setTxHash(hash);
    } catch (err: unknown) {
      console.error("Submit error:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setErrorMsg(friendlyError(msg));
      setStatus("error");
    }
  }, [isConnected, form, writeContractAsync, address]);

  function handleReset() {
    setStatus("idle");
    setVerdict(null);
    setTxHash("");
    setClaimId(null);
    setErrorMsg("");
    setForm({
      claimAmount: "",
      providerId: "",
      patientHash: "",
      serviceCode: "",
      claimDate: "",
    });
  }

  const isProcessing = [
    "encrypting",
    "submitting",
    "waiting",
    "polling",
  ].includes(status);
  const canSubmit = !!(
    isConnected &&
    form.claimAmount &&
    form.providerId &&
    form.patientHash &&
    !isProcessing
  );

  return (
    <>
      {/* NAV */}
      <nav className="dash-nav">
        <Link to="/" className="nav-logo">
          Null<span>Claim</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="nav-network">
            <span className="network-dot" /> Sepolia Testnet
          </div>
          <WalletButton />
        </div>
      </nav>

      <div className="dash-layout">
        {/* ── LEFT ── */}
        <div className="left-col">
          {/* FORM */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Submit Insurance Claim</span>
              <span className="panel-badge">FHE-ENCRYPTED</span>
            </div>
            <div className="panel-body">
              {!isConnected && (
                <div className="not-connected-notice">
                  Connect your wallet to submit a claim
                </div>
              )}
              <div className="form-row">
                <label className="form-label">Claim Amount (USD)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 12400"
                  type="number"
                  value={form.claimAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, claimAmount: e.target.value }))
                  }
                  disabled={isProcessing}
                />
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label className="form-label">Provider ID</label>
                  <input
                    className="form-input"
                    placeholder="MED-0042"
                    value={form.providerId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, providerId: e.target.value }))
                    }
                    disabled={isProcessing}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Service Code</label>
                  <input
                    className="form-input"
                    placeholder="ICD-J18.9"
                    value={form.serviceCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serviceCode: e.target.value }))
                    }
                    disabled={isProcessing}
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Patient Hash</label>
                <input
                  className="form-input"
                  placeholder="keccak256 of patient ID"
                  value={form.patientHash}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, patientHash: e.target.value }))
                  }
                  disabled={isProcessing}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Claim Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.claimDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, claimDate: e.target.value }))
                  }
                  disabled={isProcessing}
                />
              </div>
              {status === "idle" && (
                <button
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {!isConnected ?
                    "Connect Wallet First"
                  : "Encrypt & Submit Claim →"}
                </button>
              )}
              {(status === "done" || status === "error") && (
                <button className="btn-reset" onClick={handleReset}>
                  Submit another claim
                </button>
              )}
            </div>
          </div>

          {/* PROGRESS */}
          {status !== "idle" && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Processing</span>
              </div>
              <div className="panel-body">
                {STATUS_STEPS.map((s) => {
                  const state = getStepState(status, s.key);
                  return (
                    <div className="step-row" key={s.key}>
                      <div className={`step-dot ${state}`}>
                        {state === "done" ? "✓" : "·"}
                      </div>
                      <span className={`step-text ${state}`}>{s.label}</span>
                      {state === "active" && <span className="spin-sm" />}
                    </div>
                  );
                })}

                {status === "encrypting" && (
                  <div className="enc-box">
                    <div className="enc-label">ENCRYPTING INPUTS</div>
                    <div className="enc-text-preview live">{scrambleTxt}</div>
                  </div>
                )}

                {txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-pill"
                    style={{ textDecoration: "none", marginTop: "12px" }}
                  >
                    ⛓ TX: {txHash.slice(0, 16)}...{txHash.slice(-8)} ↗
                  </a>
                )}

                {claimId !== null && (
                  <div className="tx-pill" style={{ marginTop: "8px" }}>
                    🔖 Claim ID: #{claimId.toString()}
                  </div>
                )}

                {status === "error" && errorMsg && (
                  <div className="error-box">
                    {errorMsg}
                    {txHash && (
                      <div style={{ marginTop: "8px" }}>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "var(--accent)",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "11px",
                          }}
                        >
                          ↗ View transaction on Etherscan
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {status === "polling" && (
                  <div className="polling-note">
                    Waiting for Zama Gateway to decrypt verdict. This takes
                    30–90 seconds on Sepolia.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VERDICT */}
          {status === "done" && verdict && (
            <div className={`verdict-box ${verdict.toLowerCase()}`}>
              <div className="verdict-icon">
                {verdict === "CLEAN" ? "✅" : "🚨"}
              </div>
              <div className={`verdict-tag ${verdict.toLowerCase()}`}>
                {verdict === "CLEAN" ?
                  "NO FRAUD DETECTED"
                : "FRAUD SIGNALS DETECTED"}
              </div>
              <div className="verdict-heading">
                {verdict === "CLEAN" ? "Claim is Clean" : "Claim Flagged"}
              </div>
              <div className="verdict-sub">
                {verdict === "CLEAN" ?
                  "The FHE contract found no matching fraud patterns. No patient data was exposed during evaluation."
                : "One or more fraud signals triggered. Claim escalated for manual review. No patient data was exposed."
                }
              </div>
              {txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-pill"
                  style={{
                    marginTop: "14px",
                    textDecoration: "none",
                    display: "inline-flex",
                  }}
                >
                  ⛓ View on Etherscan ↗
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div className="right-col">
          {/* CONTRACT INFO */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Contract</span>
              <span className="panel-badge">LIVE</span>
            </div>
            <div className="panel-body">
              <div className="rule-row">
                <div className="rule-label">Address</div>
                <a
                  href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rule-code"
                  style={{ color: "var(--accent)", textDecoration: "none" }}
                >
                  {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}{" "}
                  ↗
                </a>
              </div>
              <div className="rule-row">
                <div className="rule-label">Network</div>
                <div className="rule-code">Ethereum Sepolia (11155111)</div>
              </div>
              <div className="rule-row">
                <div className="rule-label">Connected Wallet</div>
                <div className="rule-code">
                  {address ?
                    `${address.slice(0, 8)}...${address.slice(-6)}`
                  : "Not connected"}
                </div>
              </div>
            </div>
          </div>

          {/* PRIVACY */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Privacy Guarantees</span>
            </div>
            <div className="panel-body">
              {[
                {
                  icon: "🔐",
                  title: "Client-side encryption",
                  desc: "All fields are encrypted in your browser before any data leaves your device.",
                },
                {
                  icon: "⛓️",
                  title: "Ciphertext-only contract",
                  desc: "The NullClaim contract never decrypts inputs. All comparisons run on euint64 and ebool types.",
                },
                {
                  icon: "🎯",
                  title: "Minimal decryption",
                  desc: "Only the final boolean verdict is decrypted via the Zama Gateway. Nothing else ever surfaces.",
                },
              ].map((item) => (
                <div className="info-row" key={item.title}>
                  <div className="info-icon">{item.icon}</div>
                  <div>
                    <div className="info-title">{item.title}</div>
                    <div className="info-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FRAUD RULES */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Active Fraud Rules</span>
              <span className="panel-badge">ON-CHAIN</span>
            </div>
            <div className="panel-body">
              {FRAUD_RULES.map((r) => (
                <div className="rule-row" key={r.label}>
                  <div className="rule-label">{r.label}</div>
                  <div className="rule-code">{r.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* HISTORY */}
          {history.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Your Claims</span>
              </div>
              <div className="panel-body">
                {history.map((h, i) => (
                  <div className="history-row" key={i}>
                    <span className="history-id">{h.id}</span>
                    <div style={{ flex: 1 }}>
                      <div className="history-amount">{h.amount}</div>
                      <div className="history-provider">
                        {h.provider} · {h.time}
                      </div>
                    </div>
                    <span
                      className={`verdict-chip ${h.verdict?.toLowerCase()}`}
                    >
                      {h.verdict}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

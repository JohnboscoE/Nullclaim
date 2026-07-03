import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CybercoreBackground from "@/components/ui/cybercore-section-hero";

const STATS = [
  { value: "$308B", label: "Lost to healthcare fraud annually" },
  { value: "0", label: "Bytes of patient data exposed", accent: true },
  { value: "100%", label: "FHE-computed verdicts" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Insurer submits claim",
    desc: "An encrypted claim bundle — amount, provider ID, patient hash, and timestamp — is submitted from the frontend using the Zama SDK. No plaintext leaves the browser.",
  },
  {
    step: "02",
    title: "FHE contract evaluates",
    desc: "The NullClaim smart contract computes fraud signals over fully encrypted inputs. No validator, node, or operator ever sees the raw data.",
  },
  {
    step: "03",
    title: "Verdict is decrypted",
    desc: "The Gateway triggers a threshold decryption of only the boolean result. CLEAN or FLAGGED. The claim details remain sealed forever.",
  },
];

const FEATURES = [
  {
    icon: "🔐",
    title: "Homomorphic Encryption",
    desc: "Claims are encrypted client-side using FHEVM before hitting the chain. The contract computes over ciphertext — raw claim data never exists on-chain.",
  },
  {
    icon: "⚡",
    title: "Real-Time Fraud Scoring",
    desc: "Encrypted comparison operators detect duplicate submissions, inflated amounts, and blacklisted providers — without reading a single field.",
  },
  {
    icon: "🛡️",
    title: "Zero-Knowledge Result",
    desc: "Only a boolean verdict exits the contract: CLEAN or FLAGGED. No patient data. No claim amounts. No provider identities.",
  },
  {
    icon: "⛓️",
    title: "Sepolia Testnet Ready",
    desc: "Deployed on Ethereum Sepolia with full Zama FHEVM integration. Gateway and KMS addresses verified. Production-grade architecture.",
  },
];

// ── Pipeline animation ────────────────────────────────────────────────
function ClaimPipeline() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (phase !== 0) return;
    const t = setTimeout(() => setPhase(1), 400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 0 || phase > 4) return;
    const delays = [1200, 2200, 3500, 5200];
    const timers = delays.map((ms, i) => setTimeout(() => setPhase(i + 2), ms));
    const reset = setTimeout(() => setPhase(0), 8000);
    return () => [...timers, reset].forEach(clearTimeout);
  }, [phase === 1 ? phase : -1]);

  return (
    <div className="pipeline-wrapper">
      <div className="pipeline-card">
        <div className="pipeline-header">
          <span className="pipeline-badge">LIVE DEMO</span>
          <span
            className="pipeline-dot"
            style={{ background: phase > 0 ? "var(--accent)" : "#1E1E2E" }}
          />
        </div>

        {/* Step 1 */}
        <div
          className={`pipeline-step ${
            phase >= 2 ? "step-done"
            : phase === 1 ? "step-active"
            : ""
          }`}
        >
          <div className="step-lbl">① Claim Submitted</div>
          <div className="step-content">
            {phase >= 1 ?
              <>
                <span className="field-key">AMT </span>
                <span className="field-val">$12,400</span>
                <span className="field-sep"> | </span>
                <span className="field-key">PRV </span>
                <span className="field-val">MED-0042</span>
                <span className="field-sep"> | </span>
                <span className="field-key">PAT </span>
                <span className="field-val">****8821</span>
              </>
            : <span className="muted-text">Waiting for submission...</span>}
          </div>
        </div>

        <div className={`pipeline-arrow ${phase >= 2 ? "arrow-active" : ""}`}>
          ↓
        </div>

        {/* Step 2 */}
        <div
          className={`pipeline-step ${
            phase >= 3 ? "step-done"
            : phase === 2 ? "step-active"
            : ""
          }`}
        >
          <div className="step-lbl">② FHE Encryption (Zama SDK)</div>
          <div className="step-content">
            {phase >= 2 ?
              <span className="enc-text">
                {phase === 2 ?
                  <>
                    <span className="spinner-sm" /> Encrypting to euint64...
                  </>
                : "euint64[0xA3F2C1] | ebytes[0x9D...] | ebool[sealed]"}
              </span>
            : <span className="muted-text">Pending encryption...</span>}
          </div>
        </div>

        <div className={`pipeline-arrow ${phase >= 3 ? "arrow-active" : ""}`}>
          ↓
        </div>

        {/* Step 3 */}
        <div
          className={`pipeline-step ${
            phase >= 4 ? "step-done"
            : phase === 3 ? "step-active"
            : ""
          }`}
        >
          <div className="step-lbl">③ FHE Contract Evaluates</div>
          <div className="step-content">
            {phase >= 3 ?
              <span className="compute-text">
                {phase === 3 ?
                  <>
                    <span className="spinner-sm" /> Computing over ciphertext...
                  </>
                : "FHE.gt(amount, threshold) → ebool | FHE.eq(provider, blacklist) → ebool"
                }
              </span>
            : <span className="muted-text">Waiting for encrypted input...</span>
            }
          </div>
        </div>

        <div className={`pipeline-arrow ${phase >= 4 ? "arrow-active" : ""}`}>
          ↓
        </div>

        {/* Step 4 */}
        <div className={`pipeline-step ${phase >= 4 ? "step-verdict" : ""}`}>
          <div className="step-lbl">④ Verdict Decrypted</div>
          <div className="step-content">
            {phase >= 4 ?
              <span className="verdict-clean-text">
                ✓ VERDICT: CLEAN — No fraud signals detected
              </span>
            : <span className="muted-text">Awaiting computation...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <Link to="/" className="nav-logo">
          Null<span>Claim</span>
        </Link>
        <div className="nav-links">
          <a href="#how-it-works" className="nav-link">
            How It Works
          </a>
          <a href="#features" className="nav-link">
            Features
          </a>
          <a
            href="https://github.com/nullclaim"
            className="nav-link"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
        <Link to="/dashboard" className="nav-cta">
          Launch App →
        </Link>
      </nav>

      {/* HERO with Cybercore */}
      <section className="hero">
        <CybercoreBackground beamCount={70} />
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            POWERED BY ZAMA FHEVM · SEPOLIA TESTNET
          </div>
          <h1 className="hero-title">
            Fraud detection that
            <br />
            <span className="hero-title-accent">never sees the claim.</span>
          </h1>
          <p className="hero-subtitle">
            NullClaim uses Fully Homomorphic Encryption to evaluate insurance
            claims for fraud signals — on-chain, in real time, without exposing
            a single byte of patient or payment data.
          </p>
          <div className="hero-actions">
            <Link to="/dashboard" className="btn-primary">
              Submit a Claim →
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              See how it works
            </a>
          </div>
          <div className="stats-bar">
            {STATS.map((s, i) => (
              <div className="stat-item" key={i}>
                <div className={`stat-value ${s.accent ? "accent" : ""}`}>
                  {s.value}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="demo-section" id="demo">
        <div className="demo-inner">
          <div className="demo-copy">
            <div className="section-eyebrow">INTERACTIVE DEMO</div>
            <h2 className="section-title">
              Watch a claim get verified in real time
            </h2>
            <p className="section-sub">
              Every field is encrypted before it leaves the browser. The
              contract computes entirely over ciphertext. Only the final boolean
              ever gets decrypted.
            </p>
            <Link to="/dashboard" className="btn-primary">
              Try it live →
            </Link>
          </div>
          {mounted && <ClaimPipeline />}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works">
        <div className="section-eyebrow">HOW IT WORKS</div>
        <h2 className="section-title">Three steps. Zero exposure.</h2>
        <p className="section-sub">
          NullClaim's architecture is built around a single guarantee: the
          sensitive content of a claim is never readable by any party, on or off
          chain.
        </p>
        <div className="hiw-grid">
          {HOW_IT_WORKS.map((item) => (
            <div className="hiw-card" key={item.step}>
              <div className="hiw-step">{item.step}</div>
              <div className="hiw-title">{item.title}</div>
              <div className="hiw-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="section-eyebrow">CAPABILITIES</div>
        <h2 className="section-title">Built for production-grade privacy.</h2>
        <p className="section-sub">
          Every component of NullClaim is purpose-built to handle sensitive
          financial and medical data under the strictest cryptographic
          guarantees.
        </p>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to verify without revealing?</h2>
          <p className="cta-sub">
            Connect your wallet, submit a test claim, and see FHE fraud
            detection in action on Sepolia testnet.
          </p>
          <div className="hero-actions">
            <Link to="/dashboard" className="btn-primary">
              Launch App →
            </Link>
            <a
              href="https://github.com/nullclaim"
              className="btn-secondary"
              target="_blank"
              rel="noreferrer"
            >
              View Source
            </a>
          </div>
          <p className="cta-mono">
            Deployed on Ethereum Sepolia · Built with Zama FHEVM · Open Source
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-logo">
          Null<span>Claim</span>
        </div>
        <div className="footer-note">
          © 2026 NullClaim · Zama Developer Program
        </div>
        <div className="footer-links">
          <a
            href="https://github.com/nullclaim"
            className="footer-link"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://docs.zama.ai"
            className="footer-link"
            target="_blank"
            rel="noreferrer"
          >
            Zama Docs
          </a>
          <Link to="/dashboard" className="footer-link">
            App
          </Link>
        </div>
      </footer>
    </>
  );
}

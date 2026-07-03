import { Router, Request, Response } from "express";
import { getClaimVerdict, pollForVerdict } from "../services/zama";

export const verdictRoutes = Router();

/**
 * GET /api/verdicts/:claimId
 * Reads the current verdict state for a claim.
 * If not yet decrypted, returns { decrypted: false }.
 */
verdictRoutes.get("/:claimId", async (req: Request, res: Response) => {
  const claimId = BigInt(req.params.claimId);

  try {
    const verdict = await getClaimVerdict(claimId);
    res.json({
      claimId: Number(claimId),
      decrypted:   verdict.decrypted,
      isFraud:     verdict.isFraud,
      submitter:   verdict.submitter,
      submittedAt: verdict.submittedAt,
    });
  } catch (err) {
    console.error("[GET /verdicts/:claimId]", err);
    res.status(500).json({ error: "Failed to fetch verdict" });
  }
});

/**
 * GET /api/verdicts/:claimId/poll
 * Long-polls until the Gateway has decrypted the verdict, then returns.
 * Times out after ~60 seconds (20 attempts × 3s).
 */
verdictRoutes.get("/:claimId/poll", async (req: Request, res: Response) => {
  const claimId = BigInt(req.params.claimId);

  try {
    const result = await pollForVerdict(claimId);
    if (!result) {
      return res.status(408).json({ error: "Verdict not ready — Gateway decryption still pending" });
    }
    res.json({ claimId: Number(claimId), decrypted: true, isFraud: result.isFraud });
  } catch (err) {
    console.error("[GET /verdicts/poll]", err);
    res.status(500).json({ error: "Polling failed" });
  }
});
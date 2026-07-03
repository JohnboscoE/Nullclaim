import { Router, Request, Response } from "express";
import { getTotalClaims, getClaimsBySubmitter } from "../services/zama";
import { isAddress } from "viem";

export const claimRoutes = Router();

/**
 * GET /api/claims/total
 * Returns total number of claims submitted to the contract.
 */
claimRoutes.get("/total", async (_req: Request, res: Response) => {
  try {
    const total = await getTotalClaims();
    res.json({ total });
  } catch (err) {
    console.error("[GET /claims/total]", err);
    res.status(500).json({ error: "Failed to fetch total claims" });
  }
});

/**
 * GET /api/claims/submitter/:address
 * Returns all claim IDs for a given submitter wallet address.
 */
claimRoutes.get("/submitter/:address", async (req: Request, res: Response) => {
  const { address } = req.params;

  if (!isAddress(address)) {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }

  try {
    const claimIds = await getClaimsBySubmitter(address);
    res.json({ address, claimIds });
  } catch (err) {
    console.error("[GET /claims/submitter]", err);
    res.status(500).json({ error: "Failed to fetch claims for address" });
  }
});
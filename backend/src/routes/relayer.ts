import { Router, Request, Response } from "express";

export const relayerRoutes = Router();

const ZAMA_RELAYER_BASE = process.env.ZAMA_RELAYER_URL || "https://relayer.testnet.zama.cloud";

/**
 * Proxy all Zama relayer requests through the backend to avoid CORS.
 * The frontend sets relayerUrl to http://localhost:4000/api/relayer/11155111
 * The SDK then calls /api/relayer/11155111/v1/keyurl etc.
 */
relayerRoutes.all("/:chainId/*", async (req: Request, res: Response) => {
  const rest = (req.params as Record<string, string>)[0] || "";
  const target = `${ZAMA_RELAYER_BASE}/v1/${rest}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.ZAMA_RELAYER_API_KEY) {
      const headerName = process.env.ZAMA_RELAYER_API_KEY_HEADER || "X-API-Key";
      headers[headerName] = process.env.ZAMA_RELAYER_API_KEY;
    }

    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    res.status(response.status);
    res.set("Access-Control-Allow-Origin", "*");

    if (contentType.includes("application/json")) {
      const json = await response.json();
      res.json(json);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    console.error(`[Relayer proxy] Error proxying to ${target}:`, err);
    res.status(502).json({ error: "Relayer proxy failed", target });
  }
});

// Handle CORS preflight
relayerRoutes.options("/*", (_req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.sendStatus(200);
});
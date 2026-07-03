import { Router, Request, Response } from "express";

export const relayerRoutes = Router();

const ZAMA_RELAYER_BASE = (process.env.ZAMA_RELAYER_URL || "https://relayer.testnet.zama.cloud").replace(/\/$/, "");

relayerRoutes.all("*", async (req: Request, res: Response) => {
  // Strip /api/relayer/11155111 prefix, forward the rest
  const path = req.path === "/" ? "" : req.path;
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = `${ZAMA_RELAYER_BASE}${path}${query}`;

  console.log(`[Relayer proxy] ${req.method} ${target}`);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (process.env.ZAMA_RELAYER_API_KEY) {
      const headerName = process.env.ZAMA_RELAYER_API_KEY_HEADER || "X-API-Key";
      headers[headerName] = process.env.ZAMA_RELAYER_API_KEY;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(target, fetchOptions);

    console.log(`[Relayer proxy] Response: ${response.status} from ${target}`);

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(response.status);

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      res.json(json);
    } else {
      const text = await response.text();
      console.log(`[Relayer proxy] Non-JSON response: ${text.slice(0, 200)}`);
      res.send(text);
    }
  } catch (err) {
    console.error(`[Relayer proxy] Error proxying to ${target}:`, err);
    res.status(502).json({
      error: "Relayer proxy failed",
      target,
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

relayerRoutes.options("*", (_req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});
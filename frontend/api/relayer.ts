import type { VercelRequest, VercelResponse } from "@vercel/node";

const ZAMA_RELAYER_BASE = "https://relayer.testnet.zama.cloud";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParts = req.query.path;
  const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts || "";
  const target = `${ZAMA_RELAYER_BASE}/${path}`;

  console.log(`[Relayer] ${req.method} ${target}`);

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: req.method !== "GET" && req.method !== "HEAD" && req.body
        ? JSON.stringify(req.body)
        : undefined,
    });

    const text = await response.text();
    console.log(`[Relayer] Response ${response.status}: ${text.slice(0, 200)}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(response.status);

    try {
      res.json(JSON.parse(text));
    } catch {
      res.send(text);
    }
  } catch (err) {
    console.error("[Relayer] Error:", err);
    res.status(502).json({
      error: "Relayer proxy failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
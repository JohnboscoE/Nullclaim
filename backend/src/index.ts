import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { claimRoutes } from "./routes/claims";
import { verdictRoutes } from "./routes/verdicts";
import { relayerRoutes } from "./routes/relayer";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: [
    "https://nullclaim-olive.vercel.app",
    "http://localhost:3000",
    "*"
  ]
}));
app.use(express.json());

app.use("/api/claims",         claimRoutes);
app.use("/api/verdicts",       verdictRoutes);
app.use("/api/relayer",        relayerRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nullclaim-backend", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`NullClaim backend running on http://localhost:${PORT}`);
  console.log(`Relayer proxy: http://localhost:${PORT}/api/relayer/:chainId/*`);
  console.log(`Proxying to: ${process.env.ZAMA_RELAYER_URL || "https://relayer.testnet.zama.cloud"}`);
});

export default app;
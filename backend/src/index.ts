import express from "express";
import cors from "cors";
import https from "https";
import fs from "fs";
import { AuditLogger } from "./services/audit-logger.js";
import { createApiRouter } from "./routes/index.js";

const app = express();
const PORT = process.env.PORT ?? 3001;
const USE_TLS = process.env.USE_TLS === "true";

// Initialize services
const auditLogger = new AuditLogger();

// Enable CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

// Public health check endpoint (no authentication required)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Mount all API routes
app.use("/api", createApiRouter(auditLogger));

/**
 * Start server with TLS 1.2+ support when USE_TLS=true
 * 
 * Validates: Requirements 9.2 - TLS 1.2+ for data in transit
 */
if (USE_TLS) {
  // TLS configuration for production
  // In production, load actual certificates from secure storage
  const tlsOptions = {
    minVersion: "TLSv1.2" as const,
    // In production, load from environment or secure key management:
    // key: fs.readFileSync(process.env.TLS_KEY_PATH),
    // cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  };

  // For development/testing, check if cert files exist
  const keyPath = process.env.TLS_KEY_PATH || "./certs/key.pem";
  const certPath = process.env.TLS_CERT_PATH || "./certs/cert.pem";

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    tlsOptions.key = fs.readFileSync(keyPath);
    tlsOptions.cert = fs.readFileSync(certPath);

    https.createServer(tlsOptions, app).listen(PORT, () => {
      console.log(`BodyTrace API running on port ${PORT} with TLS 1.2+`);
    });
  } else {
    console.warn("TLS enabled but certificates not found. Falling back to HTTP.");
    console.warn(`Expected key at: ${keyPath}`);
    console.warn(`Expected cert at: ${certPath}`);
    app.listen(PORT, () => {
      console.log(`BodyTrace API running on port ${PORT} (HTTP fallback)`);
    });
  }
} else {
  // Development mode without TLS
  app.listen(PORT, () => {
    console.log(`BodyTrace API running on port ${PORT}`);
  });
}

export default app;

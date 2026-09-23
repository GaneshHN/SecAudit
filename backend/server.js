const express = require("express");
const cors = require("cors");
const scanRoutes = require("./routes/scanRoutes");
const asyncScanRoutes = require("./src/api/routes/scanRoutes");
const jobRoutes = require("./src/api/routes/jobRoutes");
const apiMetrics = require("./src/api/apiMetrics");
const { healthCheckService } = require('./src/monitoring/HealthCheckService');
const { queueService } = require('./src/queue/QueueService');
const { env } = require('./config/env');

const app = express();
const PORT = env.PORT || process.env.PORT || 5000;

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global shutdown state
let isShuttingDown = false;

// Routes
app.use("/api", scanRoutes); // Legacy backward-compatible endpoint
app.use("/api/v1/scan", asyncScanRoutes); // New async endpoint
app.use("/api/v1/jobs", jobRoutes); // Job status and result endpoint
app.get("/api/v1/metrics", (req, res) => res.json({ success: true, data: apiMetrics.getMetrics() }));

const healthRouter = express.Router();

// Liveness Probe
healthRouter.get("/liveness", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness Probe
healthRouter.get("/readiness", async (_req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: "not_ready" });
  }

  // 1. Check Infrastructure
  const sysHealth = await healthCheckService.getSystemHealth();
  if (sysHealth.status === 'Unavailable') {
    return res.status(503).json({ status: "not_ready", details: sysHealth });
  }

  // 2. Evaluate Queue Backpressure
  const threshold = env.READINESS_QUEUE_THRESHOLD || process.env.READINESS_QUEUE_THRESHOLD || 0;
  if (threshold > 0) {
    const q = queueService.getQueue('scan');
    if (q) {
      const stats = await q.getStats();
      if (stats.queued >= threshold) {
         return res.status(503).json({ status: "not_ready" });
      }
    }
  }

  res.json({ status: "ready" });
});

// Legacy Health check
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", service: "SecAudit DevSecOps Scanner", uptime: process.uptime() });
});

app.use("/health", healthRouter);
app.use("/api/health", healthRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

let server;

// Graceful shutdown
const performShutdown = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[server.js] Shutdown received. Closing server...`);
  if (server) {
    server.close(() => {
      console.log('Server closed.');
    });
  } else {
    console.log('Server closed.');
  }
};

process.on('SIGINT', performShutdown);
process.on('SIGTERM', performShutdown);

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`\n  SecAudit Backend running on http://localhost:${PORT}`);
    console.log(`  POST /api/scan — Submit a repo URL or ZIP for scanning`);
    console.log(`  GET  /health   — Health check\n`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️  Port ${PORT} is busy, trying ${+PORT + 1}...`);
      server.listen(+PORT + 1);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });
}

module.exports = app;

require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const { auth } = require("express-oauth2-jwt-bearer");

const patientRoutes = require("./routes/patients");
const documentRoutes = require("./routes/documents");
const dashboardRoutes = require("./routes/dashboard");
const dropbox = require("./services/dropbox");

const app = express();
const PORT = Number(process.env.PORT) || 5001;

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// Auth0 Configuration
const authConfigured = Boolean(
  process.env.AUTH0_DOMAIN &&
  process.env.AUTH0_AUDIENCE
);

// Local demonstration mode (strictly disabled in production)
const isDemoMode = () => process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

// Configure Auth0 JWT verification when settings are provided
let jwtCheck = null;
if (authConfigured) {
  const domain = process.env.AUTH0_DOMAIN.replace(/\/$/, "");
  const clientId = process.env.AUTH0_CLIENT_ID || "CtrsQDB2zD2lGrziO78I1wWlq4CU6BTl";
  const validAudiences = [
    process.env.AUTH0_AUDIENCE,
    clientId
  ].filter(Boolean);

  jwtCheck = auth({
    audience: validAudiences,
    issuerBaseURL: `https://${domain}/`,
    tokenSigningAlg: "RS256"
  });
}

// Authentication middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const demoActive = isDemoMode();

  // 1. Explicit local demo mode (development only)
  if (demoActive) {
    if (token && token !== "demo-token" && jwtCheck) {
      // If a real token was sent, attempt verification
      return jwtCheck(req, res, (err) => {
        if (!err) return next();
        // Fall back to demo user if JWT fails during demo mode
        req.auth = {
          payload: {
            sub: "demo-staff-001",
            name: "Demo Staff (Local Exam)",
            email: "staff@carepoint.local"
          }
        };
        next();
      });
    }

    // Attach mock identity in demo mode
    req.auth = {
      payload: {
        sub: "demo-staff-001",
        name: "Demo Staff (Local Exam)",
        email: "staff@carepoint.local"
      }
    };
    return next();
  }

  // 2. Production or standard mode with Auth0 configured
  if (authConfigured && jwtCheck) {
    return jwtCheck(req, res, next);
  }

  // 3. Auth0 missing and demo mode is not enabled
  return res.status(503).json({
    error: "Authentication is not configured. Please set AUTH0_DOMAIN and AUTH0_AUDIENCE in .env, or enable DEMO_MODE=true for local development."
  });
};

// Public health check reporting accurate status of all integrations
app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.json({
    status: "ok",
    database: isDbConnected ? "connected" : "disconnected",
    databaseConfigured: Boolean(process.env.MONGODB_URI),
    auth0: authConfigured ? "configured" : "not configured",
    dropbox: dropbox.isConfigured() ? "configured" : "not configured",
    demoMode: isDemoMode(),
    environment: process.env.NODE_ENV || "development"
  });
});

// API Routes
app.use("/api/patients", requireAuth, patientRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/documents", requireAuth, documentRoutes);

// Frontend static files
app.use(express.static(path.join(__dirname, "public")));

// Fallback for SPA routing if needed
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === "UnauthorizedError" || err.status === 401) {
    return res.status(401).json({
      error: err.message || "A valid Auth0 access token is required."
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File too large. Maximum size is 10 MB."
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  if (err.status) {
    return res.status(err.status).json({
      error: err.publicMessage || err.message || "Request failed."
    });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: err.publicMessage || "An unexpected server error occurred."
  });
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log("MongoDB Atlas connected successfully.");
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
      console.log("Server will start. Database-dependent operations will report 503 until connected.");
    }
  } else {
    console.log("MongoDB not configured. Starting without database.");
  }

  if (!authConfigured) {
    if (demoMode) {
      console.log("WARNING: Local DEMO_MODE is enabled. Authentication is bypassed for local development.");
    } else {
      console.log("NOTICE: Auth0 is not configured. Protected API routes are disabled.");
    }
  }

  if (!dropbox.isConfigured()) {
    console.log("NOTICE: Dropbox is not configured. Document storage routes are disabled.");
  }

  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`CarePoint Hospital Management Portal`);
    console.log(`Local URL:   http://localhost:${PORT}`);
    console.log(`Health URL:  http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { app, start };

// Helper functions to retrieve user identity from Auth0 verified tokens
// In local demo mode, a friendly fallback identity is provided if token is absent.

function getUserId(req) {
  const userId = req.auth && req.auth.payload && req.auth.payload.sub;
  if (userId) return userId;

  const isDemo = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
  if (isDemo) return "demo-staff-001";

  const error = new Error("Authenticated user identity was not found.");
  error.status = 401;
  throw error;
}

function getUserProfile(req) {
  const payload = (req.auth && req.auth.payload) || {};
  const isDemo = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

  return {
    sub: payload.sub || (isDemo ? "demo-staff-001" : ""),
    name: payload.name || payload.nickname || (isDemo ? "Demo Staff" : ""),
    email: payload.email || (isDemo ? "staff@carepoint.local" : "")
  };
}

module.exports = { getUserId, getUserProfile };

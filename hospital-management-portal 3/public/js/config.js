// CarePoint Hospital Management Portal - Public Frontend Configuration
// NOTE: Auth0 Domain and Client ID are public browser credentials designed for client-side SPAs.
// NEVER put MongoDB connection strings, Dropbox app secrets, refresh tokens, or SESSION_SECRET here.

window.APP_CONFIG = {
  // Auth0 Tenant Domain
  AUTH0_DOMAIN: "dev-m52l8ztbrql5mrx3.us.auth0.com",

  // Auth0 Single Page Application Client ID
  AUTH0_CLIENT_ID: "CtrsQDB2zD2lGrziO78I1wWlq4CU6BTl",

  // Auth0 API Audience (Identifier of your registered API in Auth0 Dashboard)
  AUTH0_AUDIENCE: "https://hospital-management-api",

  // Backend API Base URL (empty string uses current origin: http://localhost:PORT)
  API_BASE_URL: ""
};

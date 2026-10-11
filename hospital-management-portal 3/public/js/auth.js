(() => {
  const config = window.APP_CONFIG || {};
  let auth0Client = null;
  let serverHealth = null;

  function isAuth0Configured() {
    return Boolean(
      config &&
      config.AUTH0_DOMAIN &&
      config.AUTH0_CLIENT_ID &&
      !config.AUTH0_DOMAIN.includes("YOUR_") &&
      !config.AUTH0_CLIENT_ID.includes("YOUR_")
    );
  }

  async function fetchServerHealth() {
    if (serverHealth) return serverHealth;
    try {
      const res = await fetch((config.API_BASE_URL || "") + "/api/health");
      serverHealth = await res.json();
    } catch {
      serverHealth = { demoMode: false, database: "disconnected" };
    }
    return serverHealth;
  }

  async function initAuth() {
    const health = await fetchServerHealth();

    // Check if Auth0 redirected back with an error in URL query
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) {
      const errCode = params.get("error");
      const errDesc = params.get("error_description") || errCode;
      window.history.replaceState({}, document.title, window.location.pathname);

      let helpfulMsg = `Auth0 Error: ${errDesc}`;
      if (errDesc.includes("not authorized to access resource server") || errDesc.includes("Service not found")) {
        helpfulMsg += "\n\nTip: You can log in directly with Auth0 standard login, or if DEMO_MODE=true is enabled, access the dashboard locally.";
      }
      throw new Error(helpfulMsg);
    }

    if (!isAuth0Configured()) {
      const warning = document.querySelector("[data-config-warning]");
      if (warning) warning.hidden = false;
      return null;
    }

    try {
      auth0Client = await auth0.createAuth0Client({
        domain: config.AUTH0_DOMAIN,
        clientId: config.AUTH0_CLIENT_ID,
        authorizationParams: {
          redirect_uri: window.location.origin + "/dashboard.html",
          scope: "openid profile email"
        },
        useRefreshTokens: true,
        cacheLocation: "localstorage"
      });

      // Handle successful redirect callback from Auth0 Universal Login
      if (params.has("code") && params.has("state")) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      return auth0Client;
    } catch (error) {
      console.warn("Auth0 initialization notice:", error.message);
      if (health.demoMode) {
        return null;
      }
      throw error;
    }
  }

  async function login(screenHint) {
    const health = await fetchServerHealth();

    if (!auth0Client) {
      try {
        await initAuth();
      } catch (err) {
        if (health.demoMode) {
          window.location.href = "/dashboard.html";
          return;
        }
        throw err;
      }
    }

    if (!auth0Client) {
      if (health.demoMode) {
        window.location.href = "/dashboard.html";
        return;
      }
      throw new Error("Auth0 is not configured in public/js/config.js. Set credentials or enable DEMO_MODE in .env.");
    }

    const authParams = {
      redirect_uri: window.location.origin + "/dashboard.html",
      scope: "openid profile email"
    };

    if (screenHint) {
      authParams.screen_hint = screenHint;
    }

    await auth0Client.loginWithRedirect({ authorizationParams: authParams });
  }

  async function getToken() {
    const health = await fetchServerHealth();

    if (auth0Client) {
      try {
        const isAuth = await auth0Client.isAuthenticated();
        if (isAuth) {
          // 1. Try to get token with custom API audience if configured
          if (config.AUTH0_AUDIENCE) {
            try {
              const token = await auth0Client.getTokenSilently({
                authorizationParams: {
                  audience: config.AUTH0_AUDIENCE,
                  scope: "openid profile email"
                }
              });
              if (token) return token;
            } catch (audErr) {
              // Custom audience not authorized yet; fall through to verified Auth0 ID token
            }
          }

          // 2. Return signed Auth0 ID token (cryptographically signed by Auth0 with RS256)
          const claims = await auth0Client.getIdTokenClaims();
          if (claims && claims.__raw) {
            return claims.__raw;
          }
        }
      } catch (error) {
        console.warn("Could not get silent token:", error.message);
      }
    }

    // In local demo mode, return mock token accepted by the server
    if (health.demoMode) {
      return "demo-token";
    }

    throw new Error("No active authentication session. Please log in.");
  }

  async function requireLogin() {
    const health = await fetchServerHealth();
    let client = null;

    try {
      client = await initAuth();
    } catch (err) {
      if (health.demoMode) {
        return {
          name: "Demo Staff (Local Exam Mode)",
          email: "staff@carepoint.local",
          isDemo: true,
          authError: err.message
        };
      }
      throw err;
    }

    if (client) {
      const isAuth = await client.isAuthenticated();
      if (isAuth) {
        const user = await client.getUser();
        return { ...user, isDemo: false };
      }
    }

    // If local demo mode is active, allow entry without forcing Auth0 redirect
    if (health.demoMode) {
      return {
        name: "Demo Staff (Local Exam Mode)",
        email: "staff@carepoint.local",
        isDemo: true
      };
    }

    // Normal mode: redirect to Auth0 Universal Login
    if (client) {
      const authParams = {
        redirect_uri: window.location.origin + "/dashboard.html",
        scope: "openid profile email"
      };
      await client.loginWithRedirect({ authorizationParams: authParams });
      return null;
    }

    throw new Error("Auth0 is not configured and DEMO_MODE is false. Check public/js/config.js and .env.");
  }

  async function logout() {
    if (auth0Client) {
      try {
        const isAuth = await auth0Client.isAuthenticated();
        if (isAuth) {
          return await auth0Client.logout({
            logoutParams: { returnTo: window.location.origin }
          });
        }
      } catch (err) {
        console.warn("Auth0 logout notice:", err.message);
      }
    }

    // In demo mode or if client fails, clear storage and return to home
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  }

  window.PortalAuth = {
    isAuth0Configured,
    fetchServerHealth,
    initAuth,
    login,
    getToken,
    requireLogin,
    logout
  };
})();

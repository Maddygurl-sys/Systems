document.addEventListener("DOMContentLoaded", async () => {
  const messageEl = document.querySelector("#message");
  const loginBtn = document.querySelector("#loginButton");
  const signupBtn = document.querySelector("#signupButton");
  const demoBox = document.querySelector("#demoAction");
  const demoBtn = document.querySelector("#demoButton");

  const dbStatusEl = document.querySelector("#dbStatus");
  const authStatusEl = document.querySelector("#authStatus");
  const dropboxStatusEl = document.querySelector("#dropboxStatus");

  function showMessage(text) {
    if (!text) {
      messageEl.hidden = true;
      messageEl.textContent = "";
      return;
    }
    messageEl.textContent = text;
    messageEl.hidden = false;
  }

  // Check health status from the server
  let health = { demoMode: false, database: "disconnected", auth0: "not configured", dropbox: "not configured" };
  try {
    health = await PortalAuth.fetchServerHealth();
    if (dbStatusEl) dbStatusEl.textContent = health.database || "unknown";
    if (authStatusEl) authStatusEl.textContent = health.auth0 || "unknown";
    if (dropboxStatusEl) dropboxStatusEl.textContent = health.dropbox || "unknown";

    if (health.demoMode && demoBox) {
      demoBox.hidden = false;
    }
  } catch (err) {
    console.warn("Could not fetch server health:", err.message);
  }

  // Initialize Auth0 client
  try {
    const client = await PortalAuth.initAuth();
    if (client && (await client.isAuthenticated())) {
      // User is already logged in, redirect directly to dashboard
      window.location.href = "/dashboard.html";
      return;
    }
  } catch (error) {
    showMessage(error.message);
  }

  // Button Event Listeners
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      showMessage("");
      loginBtn.disabled = true;
      loginBtn.textContent = "Connecting…";
      try {
        await PortalAuth.login();
      } catch (err) {
        showMessage(err.message);
        loginBtn.disabled = false;
        loginBtn.textContent = "Log in";
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
      showMessage("");
      signupBtn.disabled = true;
      signupBtn.textContent = "Connecting…";
      try {
        await PortalAuth.login("signup");
      } catch (err) {
        showMessage(err.message);
        signupBtn.disabled = false;
        signupBtn.textContent = "Register / Sign up";
      }
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      window.location.href = "/dashboard.html";
    });
  }
});

const { Dropbox } = require("dropbox");

function isConfigured() {
  const token = (process.env.DROPBOX_REFRESH_TOKEN || process.env.DROPBOX_ACCESS_TOKEN || "").trim();
  const appKey = (process.env.DROPBOX_APP_KEY || "").trim();
  const appSecret = (process.env.DROPBOX_APP_SECRET || "").trim();

  // Either a direct access token, a short-lived token, or App Key + Secret + Refresh Token
  return Boolean(token || (appKey && appSecret));
}

function getClient() {
  const appKey = (process.env.DROPBOX_APP_KEY || "").trim();
  const appSecret = (process.env.DROPBOX_APP_SECRET || "").trim();
  const token = (process.env.DROPBOX_REFRESH_TOKEN || process.env.DROPBOX_ACCESS_TOKEN || "").trim();

  if (!token) {
    const error = new Error("Dropbox is not configured. Please add Dropbox credentials to .env.");
    error.status = 503;
    error.publicMessage = error.message;
    throw error;
  }

  // Dropbox access tokens start with 'sl.' (short-lived) or are passed without app secret
  if (token.startsWith("sl.") || !appSecret) {
    return new Dropbox({ accessToken: token });
  }

  // Standard OAuth 2.0 refresh token flow with App Key and App Secret
  return new Dropbox({
    clientId: appKey,
    clientSecret: appSecret,
    refreshToken: token
  });
}

function formatDropboxError(err, defaultMsg) {
  let detail = "";
  if (err && err.error) {
    if (typeof err.error === "string") {
      detail = err.error;
    } else if (err.error.error_summary) {
      detail = err.error.error_summary;
    } else if (err.error.error_description) {
      detail = err.error.error_description;
    }
  }
  const msg = detail ? `${defaultMsg}: ${detail}` : (err.message || defaultMsg);
  const error = new Error(msg);
  error.status = err.status || 502;
  error.publicMessage = msg;
  return error;
}

async function uploadFile(filePath, buffer) {
  try {
    const dbx = getClient();
    return await dbx.filesUpload({
      path: filePath,
      contents: buffer,
      mode: { ".tag": "add" },
      autorename: true
    });
  } catch (err) {
    throw formatDropboxError(err, "Failed to upload document to Dropbox");
  }
}

async function createTemporaryLink(filePath) {
  try {
    const dbx = getClient();
    return await dbx.filesGetTemporaryLink({ path: filePath });
  } catch (err) {
    throw formatDropboxError(err, "Failed to create download link from Dropbox");
  }
}

async function deleteFile(filePath) {
  try {
    const dbx = getClient();
    return await dbx.filesDeleteV2({ path: filePath });
  } catch (err) {
    // If the file was already deleted or not found on Dropbox, do not throw
    if (err && err.error && err.error.error_summary && err.error.error_summary.includes("not_found")) {
      return null;
    }
    throw formatDropboxError(err, "Failed to delete file from Dropbox");
  }
}

module.exports = {
  isConfigured,
  getClient,
  uploadFile,
  createTemporaryLink,
  deleteFile
};

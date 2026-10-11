# CarePoint Hospital Management Portal

A beginner-friendly full-stack hospital management portal built with plain HTML, CSS, and vanilla JavaScript, plus Node.js, Express, MongoDB Atlas (Mongoose), Auth0 Universal Login, and the official Dropbox API. There is **no React, Angular, Vite, Next.js, TypeScript, or frontend build command**.

---

## 1. Quick Start Commands

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run automated integration test suite:**
   ```bash
   npm test
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Or production start:
   ```bash
   npm start
   ```

4. **Access the portal locally:**
   - **Frontend Welcome Page:** [http://localhost:5001](http://localhost:5001)
   - **Hospital Dashboard:** [http://localhost:5001/dashboard.html](http://localhost:5001/dashboard.html)
   - **System Health Check:** [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## 2. Environment Configuration

### Backend Secrets (`.env`)
Create your private `.env` file from the provided `.env.example`:
```bash
cp .env.example .env
```

Your `.env` should contain:
```env
PORT=5001
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
AUTH0_DOMAIN=dev-m52l8ztbrql5mrx3.us.auth0.com
AUTH0_AUDIENCE=https://hospital-management-api
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_REFRESH_TOKEN=your_refresh_token
DEMO_MODE=false
SESSION_SECRET=your_random_session_secret
```

> **Security Note:** `.env` is listed in `.gitignore` and must **never** be committed to Git or pushed to GitHub.

### Frontend Public Settings (`public/js/config.js`)
Frontend public configuration is stored in `public/js/config.js`:
```javascript
window.APP_CONFIG = {
  AUTH0_DOMAIN: "dev-m52l8ztbrql5mrx3.us.auth0.com",
  AUTH0_CLIENT_ID: "CtrsQDB2zD2lGrziO78I1wWlq4CU6BTl",
  AUTH0_AUDIENCE: "https://hospital-management-api",
  API_BASE_URL: "" // empty string uses current origin (http://localhost:5001)
};
```
*Note: Client ID and Auth0 Domain are public parameters. Client Secrets and Database Passwords must never appear here.*

---

## 3. Auth0 Universal Login Setup

Auth0 provides identity authentication and issues JWT access tokens to authorize API calls.

### Steps in Auth0 Dashboard:
1. **Create Single Page Application (SPA):**
   - Go to **Applications → Applications → Create Application**.
   - Select **Single Page Web Applications**.
   - Under **Settings**:
     - **Allowed Callback URLs:** `http://localhost:5001/dashboard.html`
     - **Allowed Logout URLs:** `http://localhost:5001/index.html, http://localhost:5001`
     - **Allowed Web Origins:** `http://localhost:5001`
   - Save changes.

2. **Register the API (`https://hospital-management-api`):**
   - Go to **Applications → APIs → Create API**.
   - **Name:** `Hospital Management API`
   - **Identifier:** `https://hospital-management-api` (Must match `AUTH0_AUDIENCE` exactly)
   - **Signing Algorithm:** `RS256`
   - Click **Create**.

### How to resolve `"Service not found"` or `"Client is not authorized to access resource server"`:
If you receive this error during login:
- **Cause 1:** The API with identifier `https://hospital-management-api` has not been created under **Applications → APIs**.
- **Cause 2:** The application was created as a "Machine to Machine" application instead of a "Single Page Application".
  - *Fix:* In **Applications → Applications → [Your App] → Settings**, set **Application Type** to **Single Page Application**.
  - *Alternative Fix:* If kept as Machine to Machine, go to **Applications → APIs → Hospital Management API → Machine to Machine Applications** tab, find your app and toggle **Authorized** ON.

---

## 4. Dropbox Cloud Document Storage Setup

Patient medical documents (PDF, PNG, JPG, DOC, DOCX up to 10 MB) are stored in Dropbox via the official SDK, and file metadata is saved in MongoDB.

### Steps in Dropbox App Console:
1. Visit [Dropbox App Console](https://www.dropbox.com/developers/apps).
2. Click **Create app**:
   - Choose **Scoped access**.
   - Choose **App folder** (or Full Dropbox).
   - Name your app (e.g. `CarePoint-Hospital-Docs`).
3. Under the **Permissions** tab, enable:
   - `files.content.write`
   - `files.content.read`
   - `files.metadata.read`
   - `files.metadata.write`
   Click **Submit**.
4. **Token Types supported:**
   - **Option A (Persistent Refresh Token - Recommended):**
     Generate an OAuth 2.0 refresh token with `token_access_type=offline`. Place `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, and `DROPBOX_REFRESH_TOKEN` in `.env`.
   - **Option B (Short-lived Access Token for Quick Testing):**
     Click **Generate token** under Settings. The generated token (starts with `sl.`) can be placed directly in `DROPBOX_REFRESH_TOKEN` or `DROPBOX_ACCESS_TOKEN`. The portal auto-detects short-lived tokens and connects seamlessly.

---

## 5. Local Exam Demo Mode (`DEMO_MODE=true`)

For practical examinations or offline demonstrations when Auth0 credentials are temporarily unavailable:
1. Set `DEMO_MODE=true` in `.env`.
2. Start the server (`npm run dev`).
3. The portal will display **"Local Demo Mode"** and allow accessing the dashboard and testing full MongoDB CRUD without an external Auth0 login redirect.
4. Protected API endpoints accept requests and associate them with a local demo staff identity (`demo-staff-001`).
5. *Security note: Demo mode is strictly disabled when `NODE_ENV=production`.*

---

## 6. API Endpoints & Postman Examples

All protected endpoints require an `Authorization: Bearer <token>` header (or `DEMO_MODE=true`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check (MongoDB, Auth0, Dropbox status) |
| `GET` | `/api/dashboard/stats` | Summary statistics (Total, Male, Female, Admitted Today) |
| `GET` | `/api/patients` | List patients with optional filters (`?search=&gender=&bloodGroup=&status=`) |
| `GET` | `/api/patients/:id` | Retrieve single patient record |
| `POST` | `/api/patients` | Create a new patient record |
| `PUT` | `/api/patients/:id` | Update existing patient record |
| `DELETE` | `/api/patients/:id` | Delete patient and associated documents |
| `GET` | `/api/documents/patient/:patientMongoId` | List documents for a patient |
| `POST` | `/api/documents/patient/:patientMongoId` | Upload document to Dropbox (`multipart/form-data`) |
| `GET` | `/api/documents/:id/download` | Get secure temporary Dropbox download link |
| `DELETE` | `/api/documents/:id` | Delete document from Dropbox and MongoDB |

### Postman Test Examples:

#### 1. System Health Check
- **Method:** `GET`
- **URL:** `http://localhost:5001/api/health`
- **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "database": "connected",
    "databaseConfigured": true,
    "auth0": "configured",
    "dropbox": "configured",
    "demoMode": false,
    "environment": "development"
  }
  ```

#### 2. Create Patient Record
- **Method:** `POST`
- **URL:** `http://localhost:5001/api/patients`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <access_token>`
- **Body (raw JSON):**
  ```json
  {
    "fullName": "Aarav Sharma",
    "age": 34,
    "gender": "Male",
    "bloodGroup": "B+",
    "diagnosis": "Type 2 Diabetes Mellitus",
    "assignedDoctor": "Dr. Ananya Roy",
    "contactNumber": "+91 98450 12345",
    "admissionDate": "2026-10-11",
    "status": "Admitted",
    "allergies": "Sulfonamides",
    "emergencyContact": "Sunita Sharma (+91 98450 12346)",
    "notes": "Patient admitted for observation."
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "message": "Patient saved successfully.",
    "patient": {
      "_id": "670966a87...",
      "patientId": "PT-818820-856",
      "fullName": "Aarav Sharma",
      "age": 34,
      "gender": "Male",
      "bloodGroup": "B+",
      "status": "Admitted"
    }
  }
  ```

#### 3. Update Patient Record
- **Method:** `PUT`
- **URL:** `http://localhost:5001/api/patients/670966a87...`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <access_token>`
- **Body (raw JSON):**
  ```json
  {
    "fullName": "Aarav Sharma",
    "age": 34,
    "gender": "Male",
    "bloodGroup": "B+",
    "diagnosis": "Type 2 Diabetes Mellitus",
    "assignedDoctor": "Dr. Ananya Roy",
    "contactNumber": "+91 98450 12345",
    "admissionDate": "2026-10-11",
    "status": "Under Observation",
    "allergies": "Sulfonamides",
    "notes": "Patient blood sugar stabilized."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Patient updated successfully.",
    "patient": { "..." }
  }
  ```

#### 4. Upload Document
- **Method:** `POST`
- **URL:** `http://localhost:5001/api/documents/patient/670966a87...`
- **Headers:**
  - `Authorization: Bearer <access_token>`
- **Body:** `form-data`
  - `category`: `Lab report`
  - `document`: `[Select file: report.pdf]`
- **Response (201 Created):**
  ```json
  {
    "message": "Document uploaded to Dropbox successfully.",
    "document": {
      "patientId": "PT-818820-856",
      "originalName": "report.pdf",
      "dropboxPath": "/HospitalManagement/Patients/PT-818820-856/1760199182-report.pdf"
    }
  }
  ```

#### 5. Get Download Link
- **Method:** `GET`
- **URL:** `http://localhost:5001/api/documents/670966b99.../download`
- **Headers:**
  - `Authorization: Bearer <access_token>`
- **Response (200 OK):**
  ```json
  {
    "url": "https://dl.dropboxusercontent.com/apitl/1/...",
    "filename": "report.pdf"
  }
  ```

---

## 7. How the Tech Stack Interacts (Exam-Friendly Summary)

For your practical examination, here is how the architecture functions end-to-end:

1. **Frontend (HTML, CSS, Vanilla JS):**
   - Renders a responsive interface.
   - Uses the official Auth0 SPA SDK (`auth0-spa-js`) to authenticate users via Auth0 Universal Login.
   - On successful sign-in, receives a JSON Web Token (JWT) API access token.
   - Sends asynchronous `fetch` requests with `Authorization: Bearer <token>` to the Express backend.
2. **Backend (Node.js & Express):**
   - Listens on port 5001.
   - Routes requests to `/api/patients`, `/api/dashboard`, `/api/documents`.
   - Protects routes using `express-oauth2-jwt-bearer`, which cryptographically verifies the token's RS256 signature, issuer domain, and audience against Auth0.
3. **Database (MongoDB Atlas & Mongoose):**
   - Connects securely using Mongoose.
   - Stores patient medical records and document metadata.
   - Enforces schema validation (age range, blood groups, enum statuses, unique Patient IDs).
4. **Cloud Storage (Dropbox API):**
   - Receives uploaded clinical files via `multer` memory storage.
   - Uploads files securely into patient-specific folders (`/HospitalManagement/Patients/<ID>/`).
   - Generates temporary expiring direct download links on demand to prevent unauthorized public exposure.

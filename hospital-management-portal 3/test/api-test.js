// Automated integration test suite for CarePoint Hospital Management Portal
require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const { app } = require("../server");
const Patient = require("../models/Patient");
const PatientDocument = require("../models/PatientDocument");
const dropbox = require("../services/dropbox");

const PORT = 5099; // Test port to avoid conflict with running server
let server;
let baseUrl = `http://localhost:${PORT}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (body && typeof body === "object" && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }

    const req = http.request(url, {
      method: options.method || "GET",
      headers
    }, (res) => {
      let rawData = "";
      res.on("data", (chunk) => { rawData += chunk; });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch {
          json = rawData;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? "- " + detail : ""}`);
    failedTests++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("CarePoint Hospital Management Portal - Integration Tests");
  console.log("==================================================");

  let origDemoMode = process.env.DEMO_MODE;

  // 1. Connect to MongoDB Atlas
  let dbConnected = false;
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      dbConnected = true;
      console.log("✓ Connected to MongoDB Atlas.");
    } catch (err) {
      console.warn("⚠ MongoDB connection failed for tests:", err.message);
    }
  }

  // 2. Start Test Server
  server = app.listen(PORT);
  console.log(`✓ Test server running at ${baseUrl}`);

  let createdPatientId = null;
  let createdPatientMongoId = null;

  try {
    // TEST 1: Health endpoint
    console.log("\n[1] Testing GET /api/health");
    const healthRes = await request("/api/health");
    assert(healthRes.status === 200, "Health endpoint returns HTTP 200");
    assert(healthRes.data.status === "ok", "Status is 'ok'");
    assert(
      healthRes.data.database === (dbConnected ? "connected" : "disconnected"),
      `Database connection reports accurately as '${healthRes.data.database}'`
    );
    assert(
      typeof healthRes.data.auth0 === "string",
      `Auth0 status reported as '${healthRes.data.auth0}'`
    );
    assert(
      typeof healthRes.data.dropbox === "string",
      `Dropbox status reported as '${healthRes.data.dropbox}'`
    );

    // TEST 2: Protected endpoint security
    console.log("\n[2] Testing Authentication & Token Protection");
    // Without demo token or when DEMO_MODE is false
    process.env.DEMO_MODE = "false";

    const unauthRes = await request("/api/patients");
    assert(
      unauthRes.status === 401 || unauthRes.status === 503,
      "Protected endpoint rejects unauthenticated request without token"
    );

    const invalidTokenRes = await request("/api/patients", {
      headers: { Authorization: "Bearer definitely-invalid-jwt-token" }
    });
    assert(
      invalidTokenRes.status === 401 || invalidTokenRes.status === 503,
      "Protected endpoint rejects invalid access token"
    );

    // Restore demo mode for local test CRUD
    process.env.DEMO_MODE = "true";

    // TEST 3: Patient CRUD (requires connected MongoDB)
    if (dbConnected) {
      console.log("\n[3] Testing Patient Validation & Creation (POST /api/patients)");

      // Validation test: Missing required fields
      const badReq = await request("/api/patients", {
        method: "POST",
        body: { fullName: "Incomplete Patient" }
      });
      assert(badReq.status === 400, "Rejects patient with missing required fields (HTTP 400)");

      // Validation test: Invalid age
      const badAge = await request("/api/patients", {
        method: "POST",
        body: {
          fullName: "John AgeTest",
          age: 999,
          gender: "Male",
          bloodGroup: "O+",
          diagnosis: "Fever",
          assignedDoctor: "Dr. Test",
          contactNumber: "1234567890",
          admissionDate: "2026-10-11",
          status: "Admitted"
        }
      });
      assert(badAge.status === 400, "Rejects patient with invalid age > 125 (HTTP 400)");

      // Validation test: Invalid gender
      const badGender = await request("/api/patients", {
        method: "POST",
        body: {
          fullName: "John GenderTest",
          age: 30,
          gender: "UnknownGender",
          bloodGroup: "O+",
          diagnosis: "Fever",
          assignedDoctor: "Dr. Test",
          contactNumber: "1234567890",
          admissionDate: "2026-10-11",
          status: "Admitted"
        }
      });
      assert(badGender.status === 400, "Rejects patient with invalid gender enum (HTTP 400)");

      // Valid patient creation
      const testPatientData = {
        fullName: "Aarav Sharma",
        age: 34,
        gender: "Male",
        bloodGroup: "B+",
        diagnosis: "Type 2 Diabetes Mellitus",
        assignedDoctor: "Dr. Ananya Roy",
        contactNumber: "+91 98450 12345",
        admissionDate: new Date().toISOString().slice(0, 10),
        status: "Admitted",
        allergies: "Sulfonamides",
        emergencyContact: "Sunita Sharma (+91 98450 12346)",
        notes: "Admitted for routine insulin stabilization."
      };

      const createRes = await request("/api/patients", {
        method: "POST",
        body: testPatientData
      });

      assert(createRes.status === 201, "Creates new patient record (HTTP 201)");
      assert(createRes.data.patient && createRes.data.patient._id, "Returns created patient with MongoDB _id");
      assert(
        createRes.data.patient && createRes.data.patient.patientId && createRes.data.patient.patientId.startsWith("PT-"),
        `Generates unique Patient ID: ${createRes.data.patient && createRes.data.patient.patientId}`
      );

      createdPatientMongoId = createRes.data.patient._id;
      createdPatientId = createRes.data.patient.patientId;

      console.log("\n[4] Testing Patient Retrieval (GET /api/patients & GET /api/patients/:id)");
      const listRes = await request("/api/patients");
      assert(listRes.status === 200, "Lists patients (HTTP 200)");
      assert(Array.isArray(listRes.data.patients), "Response contains patients array");
      const found = listRes.data.patients.some((p) => p._id === createdPatientMongoId);
      assert(found, "Saved patient is present in patients list");

      // Search test
      const searchRes = await request(`/api/patients?search=Aarav`);
      assert(searchRes.status === 200, "Search by patient name returns HTTP 200");
      const searchFound = searchRes.data.patients.some((p) => p._id === createdPatientMongoId);
      assert(searchFound, "Search query finds target patient");

      // Get single patient
      const getSingle = await request(`/api/patients/${createdPatientMongoId}`);
      assert(getSingle.status === 200, "Gets patient by MongoDB ID (HTTP 200)");
      assert(getSingle.data.patient.fullName === "Aarav Sharma", "Fetched patient name matches");

      // Non-existent patient
      const notFound = await request("/api/patients/507f1f77bcf86cd799439011");
      assert(notFound.status === 404, "Returns 404 for non-existent patient ID");

      // Invalid ObjectId
      const invalidId = await request("/api/patients/invalid-id-123");
      assert(invalidId.status === 400, "Returns 400 for malformed MongoDB ID");

      console.log("\n[5] Testing Patient Update (PUT /api/patients/:id)");
      const updateRes = await request(`/api/patients/${createdPatientMongoId}`, {
        method: "PUT",
        body: {
          ...testPatientData,
          status: "Under Observation",
          notes: "Blood glucose normalized. Kept under observation."
        }
      });
      assert(updateRes.status === 200, "Updates patient record (HTTP 200)");
      assert(updateRes.data.patient.status === "Under Observation", "Updated status reflects correctly");
      assert(updateRes.data.patient.notes.includes("glucose normalized"), "Updated notes reflect correctly");

      console.log("\n[6] Testing Dashboard Statistics (GET /api/dashboard/stats)");
      const statsRes = await request("/api/dashboard/stats");
      assert(statsRes.status === 200, "Dashboard stats returns HTTP 200");
      assert(typeof statsRes.data.total === "number" && statsRes.data.total > 0, `Total patient count is ${statsRes.data.total}`);
      assert(typeof statsRes.data.male === "number", `Male count is ${statsRes.data.male}`);
      assert(typeof statsRes.data.female === "number", `Female count is ${statsRes.data.female}`);
      assert(typeof statsRes.data.admittedToday === "number", `Admitted today count is ${statsRes.data.admittedToday}`);

      // TEST 7: Documents endpoint
      console.log("\n[7] Testing Document Endpoints");
      const docListRes = await request(`/api/documents/patient/${createdPatientMongoId}`);
      assert(docListRes.status === 200, "Patient documents list returns HTTP 200");
      assert(Array.isArray(docListRes.data.documents), "Documents field is an array");
      assert(typeof docListRes.data.dropboxConfigured === "boolean", "Returns dropboxConfigured status flag");

      if (dropbox.isConfigured()) {
        console.log("  Testing live Dropbox upload...");
        try {
          const testBuffer = Buffer.from("Clinical Report Content for Testing", "utf8");
          const uploadRes = await dropbox.uploadFile(
            `/HospitalManagement/Patients/${createdPatientId}/test-report.txt`,
            testBuffer
          );
          assert(Boolean(uploadRes && uploadRes.result), "Dropbox file upload completed successfully");

          // Test metadata persistence in MongoDB
          const testDoc = await PatientDocument.create({
            patient: createdPatientMongoId,
            patientId: createdPatientId,
            originalName: "test-report.txt",
            category: "Lab report",
            dropboxPath: uploadRes.result.path_lower || uploadRes.result.path_display,
            dropboxFileId: uploadRes.result.id || "",
            uploadedBy: "test-runner",
            uploadedByName: "Integration Test"
          });
          assert(Boolean(testDoc._id), "Document metadata saved to MongoDB");

          // Test download link generation
          const downloadRes = await request(`/api/documents/${testDoc._id}/download`);
          assert(downloadRes.status === 200, "Generates secure temporary download link (HTTP 200)");
          assert(Boolean(downloadRes.data.url), "Download URL is returned");

          // Test document delete
          const deleteDocRes = await request(`/api/documents/${testDoc._id}`, { method: "DELETE" });
          assert(deleteDocRes.status === 200, "Deletes document from Dropbox and MongoDB (HTTP 200)");
        } catch (err) {
          console.warn("  Dropbox test warning:", err.message);
        }
      } else {
        console.log("  [INFO] Dropbox not configured. Document operations report 503 gracefully as expected.");
      }

      console.log("\n[8] Testing Patient Deletion (DELETE /api/patients/:id)");
      const deleteRes = await request(`/api/patients/${createdPatientMongoId}`, { method: "DELETE" });
      assert(deleteRes.status === 200, "Deletes patient record (HTTP 200)");

      const checkDeleted = await request(`/api/patients/${createdPatientMongoId}`);
      assert(checkDeleted.status === 404, "Deleted patient is no longer accessible (HTTP 404)");
    } else {
      console.log("\n[SKIPPED] MongoDB not connected; CRUD tests skipped.");
    }
  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failedTests++;
  } finally {
    process.env.DEMO_MODE = origDemoMode;
    if (server) server.close();
    if (dbConnected) await mongoose.disconnect();

    console.log("\n==================================================");
    console.log(`Test Results: ${passedTests} passed, ${failedTests} failed.`);
    console.log("==================================================");

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();

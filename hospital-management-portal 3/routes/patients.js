const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const Patient = require("../models/Patient");
const PatientDocument = require("../models/PatientDocument");
const dropbox = require("../services/dropbox");
const { getUserId, getUserProfile } = require("../middleware/auth");

const router = express.Router();

// Middleware to verify database connectivity before executing queries
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Database is not connected. MongoDB operations are currently unavailable."
    });
  }
  next();
});

const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(file.mimetype)) {
      const err = new Error("Allowed file types: PDF, PNG, JPG, JPEG, DOC, and DOCX.");
      err.status = 400;
      err.publicMessage = "Allowed file types: PDF, PNG, JPG, JPEG, DOC, and DOCX.";
      return cb(err);
    }
    cb(null, true);
  }
});

function cleanText(value) {
  return typeof value === "string" ? value.trim() : value;
}

const VALID_GENDERS = ["Male", "Female", "Other"];
const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_STATUSES = ["Admitted", "Under Observation", "Discharged"];

function validatePatient(body) {
  const required = [
    "fullName",
    "age",
    "gender",
    "bloodGroup",
    "diagnosis",
    "assignedDoctor",
    "contactNumber",
    "admissionDate",
    "status"
  ];

  for (const key of required) {
    if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
      return `${key} is required.`;
    }
  }

  const ageNum = Number(body.age);
  if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 125) {
    return "Age must be a number between 0 and 125.";
  }

  if (!VALID_GENDERS.includes(body.gender)) {
    return `Gender must be one of: ${VALID_GENDERS.join(", ")}.`;
  }

  if (!VALID_BLOOD_GROUPS.includes(body.bloodGroup)) {
    return `Blood group must be one of: ${VALID_BLOOD_GROUPS.join(", ")}.`;
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return `Status must be one of: ${VALID_STATUSES.join(", ")}.`;
  }

  if (Number.isNaN(Date.parse(body.admissionDate))) {
    return "Admission date is invalid.";
  }

  return null;
}

function patientFields(body) {
  const fields = [
    "fullName",
    "age",
    "gender",
    "bloodGroup",
    "diagnosis",
    "assignedDoctor",
    "contactNumber",
    "admissionDate",
    "allergies",
    "status",
    "emergencyContact",
    "notes"
  ];
  const result = {};
  for (const field of fields) {
    if (body[field] !== undefined) {
      result[field] = field === "age" ? Number(body[field]) : cleanText(body[field]);
    }
  }
  return result;
}

// GET /api/patients - list patients with optional search & filters
router.get("/", async (req, res, next) => {
  try {
    const { search = "", gender = "", bloodGroup = "", status = "" } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const safeSearch = String(search).trim().slice(0, 100);
      const escaped = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { fullName: { $regex: escaped, $options: "i" } },
        { patientId: { $regex: escaped, $options: "i" } },
        { diagnosis: { $regex: escaped, $options: "i" } },
        { assignedDoctor: { $regex: escaped, $options: "i" } }
      ];
    }

    if (gender && VALID_GENDERS.includes(gender)) {
      filter.gender = gender;
    }
    if (bloodGroup && VALID_BLOOD_GROUPS.includes(bloodGroup)) {
      filter.bloodGroup = bloodGroup;
    }
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    const patients = await Patient.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ patients });
  } catch (error) {
    next(error);
  }
});

// GET /api/patients/:id - retrieve single patient by MongoDB ID
router.get("/:id", async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }
    res.json({ patient });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid patient record ID." });
    }
    next(error);
  }
});

// POST /api/patients - create a new patient (with optional document upload directly to Dropbox)
router.post("/", upload.single("document"), async (req, res, next) => {
  try {
    const problem = validatePatient(req.body);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const customId = req.body.patientId && String(req.body.patientId).trim();
    const patientId = customId || `PT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    const patient = await Patient.create({
      ...patientFields(req.body),
      patientId,
      createdBy: getUserId(req)
    });

    let uploadedDoc = null;

    // If an initial medical document was attached, upload it directly to Dropbox
    if (req.file && dropbox.isConfigured()) {
      try {
        const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._ -]/g, "_");
        const folder = `/HospitalManagement/Patients/${patient.patientId}`;
        const dropboxFilePath = `${folder}/${Date.now()}-${safeName}`;

        const result = await dropbox.uploadFile(dropboxFilePath, req.file.buffer);
        const userProfile = getUserProfile(req);

        uploadedDoc = await PatientDocument.create({
          patient: patient._id,
          patientId: patient.patientId,
          originalName: req.file.originalname,
          category: req.body.documentCategory || "Medical report",
          dropboxPath: (result && result.result && (result.result.path_lower || result.result.path_display)) || dropboxFilePath,
          dropboxFileId: (result && result.result && result.result.id) || "",
          uploadedBy: getUserId(req),
          uploadedByName: userProfile.name || userProfile.email || "Staff"
        });
      } catch (err) {
        console.warn("Could not upload initial document to Dropbox:", err.message);
      }
    }

    const message = uploadedDoc
      ? "Patient saved and medical document uploaded to Dropbox successfully!"
      : "Patient saved successfully.";

    res.status(201).json({
      message,
      patient,
      document: uploadedDoc
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "A patient with this Patient ID already exists. Please use a unique ID." });
    }
    next(error);
  }
});

// PUT /api/patients/:id - update existing patient
router.put("/:id", upload.none(), async (req, res, next) => {
  try {
    const problem = validatePatient(req.body);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: patientFields(req.body) },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    res.json({ message: "Patient updated successfully.", patient });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid patient record ID." });
    }
    next(error);
  }
});

// DELETE /api/patients/:id - delete patient and associated documents
router.delete("/:id", async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    // Clean up any Dropbox documents
    const docs = await PatientDocument.find({ patient: patient._id });
    if (dropbox.isConfigured()) {
      for (const doc of docs) {
        try {
          await dropbox.deleteFile(doc.dropboxPath);
        } catch (error) {
          console.warn("Could not delete Dropbox file:", doc.originalName, error.message);
        }
      }
    }

    await PatientDocument.deleteMany({ patient: patient._id });
    await patient.deleteOne();

    res.json({ message: "Patient and associated documents deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid patient record ID." });
    }
    next(error);
  }
});

module.exports = router;

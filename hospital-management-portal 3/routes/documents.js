const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const Patient = require("../models/Patient");
const PatientDocument = require("../models/PatientDocument");
const dropbox = require("../services/dropbox");
const { getUserId, getUserProfile } = require("../middleware/auth");

const router = express.Router();

// Guard against disconnected MongoDB
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Database is not connected. Document operations are currently unavailable."
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

// GET /api/documents/patient/:patientMongoId - list documents for a patient
router.get("/patient/:patientMongoId", async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.patientMongoId).select("_id patientId").lean();
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const documents = await PatientDocument.find({ patient: patient._id }).sort({ createdAt: -1 }).lean();
    res.json({
      documents,
      dropboxConfigured: dropbox.isConfigured()
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid patient record ID." });
    }
    next(error);
  }
});

// POST /api/documents/patient/:patientMongoId - upload file to Dropbox and store metadata
router.post("/patient/:patientMongoId", upload.single("document"), async (req, res, next) => {
  try {
    if (!dropbox.isConfigured()) {
      return res.status(503).json({
        error: "Dropbox is not configured. Cloud document storage is unavailable."
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please select a document file to upload." });
    }

    const patient = await Patient.findById(req.params.patientMongoId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const allowedCategories = ["Medical report", "Prescription", "Lab report", "Discharge summary", "Other"];
    const category = allowedCategories.includes(req.body.category) ? req.body.category : "Other";

    const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._ -]/g, "_");
    const folder = `/HospitalManagement/Patients/${patient.patientId}`;
    const dropboxFilePath = `${folder}/${Date.now()}-${safeName}`;

    const result = await dropbox.uploadFile(dropboxFilePath, req.file.buffer);

    const userProfile = getUserProfile(req);

    const metadata = await PatientDocument.create({
      patient: patient._id,
      patientId: patient.patientId,
      originalName: req.file.originalname,
      category,
      dropboxPath: (result && result.result && (result.result.path_lower || result.result.path_display)) || dropboxFilePath,
      dropboxFileId: (result && result.result && result.result.id) || "",
      uploadedBy: getUserId(req),
      uploadedByName: userProfile.name || userProfile.email || "Staff"
    });

    res.status(201).json({
      message: "Document uploaded to Dropbox successfully.",
      document: metadata
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid patient record ID." });
    }
    next(error);
  }
});

// GET /api/documents/:id/download - get secure temporary download link
router.get("/:id/download", async (req, res, next) => {
  try {
    const document = await PatientDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document record not found." });
    }

    if (!dropbox.isConfigured()) {
      return res.status(503).json({
        error: "Dropbox is not configured. Cloud download is unavailable."
      });
    }

    const linkResult = await dropbox.createTemporaryLink(document.dropboxPath);
    const downloadUrl = linkResult && linkResult.result && linkResult.result.link;

    if (!downloadUrl) {
      return res.status(502).json({ error: "Could not generate download link from Dropbox." });
    }

    res.json({
      url: downloadUrl,
      filename: document.originalName
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid document record ID." });
    }
    next(error);
  }
});

// DELETE /api/documents/:id - delete from Dropbox and database
router.delete("/:id", async (req, res, next) => {
  try {
    const document = await PatientDocument.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document record not found." });
    }

    if (dropbox.isConfigured()) {
      try {
        await dropbox.deleteFile(document.dropboxPath);
      } catch (err) {
        console.warn("Could not delete file from Dropbox:", document.dropboxPath, err.message);
      }
    }

    await document.deleteOne();
    res.json({ message: "Document deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid document record ID." });
    }
    next(error);
  }
});

module.exports = router;

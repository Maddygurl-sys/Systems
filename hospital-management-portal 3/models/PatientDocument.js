const mongoose = require("mongoose");

const patientDocumentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  patientId: { type: String, required: true, index: true },
  originalName: { type: String, required: true },
  category: {
    type: String,
    enum: ["Medical report", "Prescription", "Lab report", "Discharge summary", "Other"],
    default: "Other"
  },
  dropboxPath: { type: String, required: true },
  dropboxFileId: { type: String, default: "" },
  uploadedBy: { type: String, required: true },
  uploadedByName: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("PatientDocument", patientDocumentSchema);

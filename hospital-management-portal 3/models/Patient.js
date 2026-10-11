const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  patientId: { type: String, unique: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  age: { type: Number, required: true, min: 0, max: 125 },
  gender: { type: String, required: true, enum: ["Male", "Female", "Other"] },
  bloodGroup: {
    type: String, required: true,
    enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
  },
  diagnosis: { type: String, required: true, trim: true, maxlength: 300 },
  assignedDoctor: { type: String, required: true, trim: true, maxlength: 100 },
  contactNumber: { type: String, required: true, trim: true, maxlength: 20 },
  admissionDate: { type: Date, required: true },
  allergies: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, required: true, enum: ["Admitted", "Under Observation", "Discharged"] },
  emergencyContact: { type: String, trim: true, maxlength: 100, default: "" },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  createdBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Patient", patientSchema);

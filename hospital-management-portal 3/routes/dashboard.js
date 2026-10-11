const express = require("express");
const mongoose = require("mongoose");
const Patient = require("../models/Patient");

const router = express.Router();

router.get("/stats", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database is not connected. Dashboard stats are currently unavailable."
      });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [total, male, female, admittedToday] = await Promise.all([
      Patient.countDocuments(),
      Patient.countDocuments({ gender: "Male" }),
      Patient.countDocuments({ gender: "Female" }),
      Patient.countDocuments({ admissionDate: { $gte: start, $lt: end } })
    ]);

    res.json({ total, male, female, admittedToday });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

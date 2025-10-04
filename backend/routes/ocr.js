const express = require("express");
const multer = require("multer");
const { extractReceiptData } = require("../controllers/ocrController");

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Public OCR endpoint (no auth middleware for demo)
router.post("/extract", upload.single("receipt"), extractReceiptData);

module.exports = router;

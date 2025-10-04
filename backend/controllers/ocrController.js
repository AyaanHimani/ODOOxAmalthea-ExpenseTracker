const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const fs = require("fs");

const extractReceiptData = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const inputPath = req.file.path;
  const processedPath = `uploads/processed-${Date.now()}.png`;

  try {
    // Step 1: Preprocess image (grayscale + sharpen + resize)
    await sharp(inputPath)
      .grayscale()
      .resize({ width: 1000 })
      .sharpen()
      .toFile(processedPath);

    // Step 2: Run OCR
    const {
      data: { text, confidence },
    } = await Tesseract.recognize(processedPath, "eng");

    // Step 3: Extract fields from OCR text
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Merchant (top few lines before 'total' or 'amount')
    let merchant = "Unknown";
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const lower = lines[i].toLowerCase();
      if (!lower.includes("total") && !lower.includes("amount")) {
        merchant = lines[i];
        break;
      }
    }

    // Amount
    const amountRegex = /(\$|₹|€)?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;
    const amounts = [...text.matchAll(amountRegex)].map((m) =>
      parseFloat(m[0].replace(/[^0-9.]/g, ""))
    );
    const amount = amounts.length ? Math.max(...amounts).toFixed(2) : "0.00";

    // Date
    const dateRegex =
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Za-z]{3,9}\s?\d{1,2}[, ]\s?\d{2,4})/g;
    const dates = [...text.matchAll(dateRegex)].map((m) => m[0]);
    const date = dates.length ? dates[0] : "Not detected";

    // Description
    const description = `Expense for ${merchant !== "Unknown" ? merchant : "General"}`;

    // Step 4: Delete temp files after successful processing
    fs.unlinkSync(inputPath);
    fs.unlinkSync(processedPath);

    // Step 5: Send response
    return res.status(200).json({
      success: true,
      message: "OCR extraction successful",
      confidence: Math.round(confidence),
      merchant,
      date,
      amount,
      description,
      raw_text_preview: text.slice(0, 300),
    });
  } catch (err) {
    console.error("OCR Error:", err);

    // Cleanup in case of error
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
    } catch {}

    return res.status(500).json({
      success: false,
      message: "OCR processing failed",
      error: err.message,
    });
  }
};

module.exports = { extractReceiptData };

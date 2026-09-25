const multer = require('multer')
const { maxReceiptBytes } = require('../utils/receiptStorage')

const uploadReceipt = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxReceiptBytes, files: 1 } })

module.exports = uploadReceipt

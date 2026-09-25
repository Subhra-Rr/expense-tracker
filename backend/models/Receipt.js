const mongoose = require('mongoose')

const receiptSchema = new mongoose.Schema(
  {
    storageName: { type: String, required: true, unique: true, select: false },
    contentType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    originalName: { type: String, required: true, maxlength: 180 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', required: true, unique: true, index: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Receipt', receiptSchema)

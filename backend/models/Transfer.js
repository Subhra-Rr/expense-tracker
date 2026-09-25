const mongoose = require('mongoose')

const transferSchema = new mongoose.Schema(
  {
    sourceAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    destinationAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01, max: 1000000000000 },
    date: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    idempotencyKey: { type: String, select: false, maxlength: 120 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
  },
  { timestamps: true },
)

transferSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true })
transferSchema.index({ user: 1, date: -1, createdAt: -1 })
module.exports = mongoose.model('Transfer', transferSchema)

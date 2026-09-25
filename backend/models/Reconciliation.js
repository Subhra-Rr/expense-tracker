const mongoose = require('mongoose')

const reconciliationSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
    recordedBalance: { type: Number, required: true },
    statementBalance: { type: Number, required: true },
    difference: { type: Number, required: true },
    reconciliationDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    adjustmentAmount: { type: Number, default: 0 },
    balanceBeforeAdjustment: { type: Number },
    balanceAfterAdjustment: { type: Number },
    adjustmentReason: { type: String, trim: true, maxlength: 300 },
    adjustedAt: { type: Date },
  },
  { timestamps: true },
)

reconciliationSchema.index({ user: 1, account: 1, reconciliationDate: -1 })
module.exports = mongoose.model('Reconciliation', reconciliationSchema)

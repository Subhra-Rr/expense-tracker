const mongoose = require('mongoose')

const accountTypes = ['Cash', 'Bank Account', 'UPI / Digital Wallet', 'Savings Account', 'Other']

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    type: { type: String, required: true, enum: accountTypes },
    openingBalance: { type: Number, required: true, min: 0, max: 1000000000000 },
    currentBalance: { type: Number, required: true, min: -1000000000000, max: 1000000000000 },
    archived: { type: Boolean, default: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
  },
  { timestamps: true },
)

accountSchema.index({ user: 1, archived: 1, createdAt: -1 })

module.exports = { Account: mongoose.model('Account', accountSchema), accountTypes }

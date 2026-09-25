const mongoose = require('mongoose')

const savingsGoalEntrySchema = new mongoose.Schema(
  {
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsGoal', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
    entryType: { type: String, required: true, enum: ['contribution', 'withdrawal', 'correction'] },
    amount: { type: Number, required: true, min: -1000000000000, max: 1000000000000 },
    note: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true },
)

savingsGoalEntrySchema.index({ user: 1, goal: 1, createdAt: -1 })
module.exports = mongoose.model('SavingsGoalEntry', savingsGoalEntrySchema)

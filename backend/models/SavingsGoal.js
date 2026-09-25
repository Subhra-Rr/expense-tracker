const mongoose = require('mongoose')

const statuses = ['active', 'completed', 'archived']
const savingsGoalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    targetAmount: { type: Number, required: true, min: 0.01, max: 1000000000000 },
    currentSavedAmount: { type: Number, required: true, min: 0, max: 1000000000000, default: 0 },
    targetDate: { type: Date },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: statuses, default: 'active', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
  },
  { timestamps: true },
)

savingsGoalSchema.index({ user: 1, status: 1, targetDate: 1 })
module.exports = { SavingsGoal: mongoose.model('SavingsGoal', savingsGoalSchema), statuses }

const mongoose = require('mongoose')

const transactionTypes = ['Expense', 'Income']
const frequencies = ['Daily', 'Weekly', 'Monthly', 'Yearly']
const statuses = ['active', 'paused', 'cancelled']

const recurringRuleSchema = new mongoose.Schema(
  {
    transactionType: { type: String, required: true, enum: transactionTypes },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    amount: { type: Number, required: true, min: 0.01, max: 1000000000000 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    frequency: { type: String, required: true, enum: frequencies },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    nextDueDate: { type: Date, required: true, index: true },
    timezone: { type: String, required: true, default: 'Asia/Kolkata', maxlength: 80 },
    paymentMethod: { type: String, default: 'Other', maxlength: 40 },
    status: { type: String, enum: statuses, default: 'active', index: true },
    lastGeneratedDate: { type: Date },
    missedOccurrences: { type: Number, default: 0, min: 0 },
    processingAt: { type: Date },
    lastError: { type: String, maxlength: 500 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
  },
  { timestamps: true },
)

recurringRuleSchema.index({ user: 1, status: 1, nextDueDate: 1 })

module.exports = { RecurringRule: mongoose.model('RecurringRule', recurringRuleSchema), frequencies, statuses, transactionTypes }

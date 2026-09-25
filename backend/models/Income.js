const mongoose = require('mongoose')

const incomeCategories = ['Salary', 'Pocket Money', 'Scholarship', 'Freelance', 'Gift', 'Interest', 'Other']

const incomeSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01, max: 1000000000000 },
    source: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    category: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    date: { type: Date, required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    idempotencyKey: { type: String, select: false, maxlength: 120 },
    recurringRule: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringRule', index: true },
    recurringOccurrenceKey: { type: String, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, select: false },
  },
  { timestamps: true },
)

incomeSchema.index({ user: 1, date: -1, createdAt: -1 })
incomeSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = { Income: mongoose.model('Income', incomeSchema), incomeCategories }
